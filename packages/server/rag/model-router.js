/**
 * Model Router
 * Routes LLM requests to appropriate providers (OpenAI, OpenRouter, Anthropic)
 * Following MOTH RAG plan routing policy
 */
export class ModelRouter {
  constructor(options = {}) {
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    this.openrouterApiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    
    // Routing policy from MOTH plan
    this.routingPolicy = options.routingPolicy || {
      explain: { provider: 'openai', model: 'gpt-4-turbo' },
      impact: { provider: 'openai', model: 'gpt-4-turbo' },
      triage: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
      transform: { provider: 'openrouter', model: 'deepseek/deepseek-chat' }
    };

    // Fallback models
    this.fallbacks = options.fallbacks || {
      explain: [
        { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' }
      ],
      impact: [
        { provider: 'openrouter', model: 'mistralai/mistral-large-2411' }
      ],
      triage: [
        { provider: 'openai', model: 'gpt-4o-mini' }
      ],
      transform: [
        { provider: 'openrouter', model: 'deepseek/deepseek-chat' }
      ]
    };

    // Cost and latency tracking
    this.metrics = {
      totalCalls: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      totalLatency: 0
    };
  }

  /**
   * Route a request to the appropriate model
   * @param {string} task - Task type: 'explain', 'impact', 'triage', 'transform'
   * @param {string} prompt - User prompt
   * @param {Object} options - Additional options (maxTokens, temperature, etc.)
   */
  async route(task, prompt, options = {}) {
    const policy = this.routingPolicy[task];
    if (!policy) {
      throw new Error(`Unknown task type: ${task}`);
    }

    const startTime = Date.now();

    try {
      const result = await this.callModel(
        policy.provider,
        policy.model,
        prompt,
        options
      );

      // Track metrics
      this.trackMetrics(result, Date.now() - startTime);

      return result;
    } catch (error) {
      console.error(`❌ Primary model failed for ${task}: ${error.message}`);
      
      // Try fallbacks
      const fallbackList = this.fallbacks[task] || [];
      for (const fallback of fallbackList) {
        try {
          console.log(`🔄 Trying fallback: ${fallback.provider}/${fallback.model}`);
          const result = await this.callModel(
            fallback.provider,
            fallback.model,
            prompt,
            options
          );
          
          this.trackMetrics(result, Date.now() - startTime);
          return result;
        } catch (fallbackError) {
          console.error(`❌ Fallback failed: ${fallbackError.message}`);
        }
      }

      throw new Error(`All models failed for task ${task}`);
    }
  }

  /**
   * Call a specific model
   */
  async callModel(provider, model, prompt, options = {}) {
    switch (provider) {
      case 'openai':
        return await this.callOpenAI(model, prompt, options);
      case 'openrouter':
        return await this.callOpenRouter(model, prompt, options);
      case 'anthropic':
        return await this.callAnthropic(model, prompt, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(model, prompt, options = {}) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: options.systemPrompt || 'You are a helpful code analysis assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    
    return {
      provider: 'openai',
      model: model,
      content: data.choices[0].message.content,
      tokensIn: data.usage.prompt_tokens,
      tokensOut: data.usage.completion_tokens,
      cost: this.calculateCost('openai', model, data.usage)
    };
  }

  /**
   * Call OpenRouter API
   */
  async callOpenRouter(model, prompt, options = {}) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openrouterApiKey}`,
        'HTTP-Referer': 'https://intellimap.dev',
        'X-Title': 'IntelliMap RAG'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: options.systemPrompt || 'You are a helpful code analysis assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    
    return {
      provider: 'openrouter',
      model: model,
      content: data.choices[0].message.content,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      cost: this.calculateCost('openrouter', model, data.usage)
    };
  }

  /**
   * Call Anthropic API
   */
  async callAnthropic(model, prompt, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: options.maxTokens || 2000,
        messages: [
          { role: 'user', content: prompt }
        ],
        system: options.systemPrompt || 'You are a helpful code analysis assistant.'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    
    return {
      provider: 'anthropic',
      model: model,
      content: data.content[0].text,
      tokensIn: data.usage.input_tokens,
      tokensOut: data.usage.output_tokens,
      cost: this.calculateCost('anthropic', model, data.usage)
    };
  }

  /**
   * Calculate cost (rough estimates)
   */
  calculateCost(provider, model, usage) {
    // Simplified cost calculation - should be updated with actual pricing
    const pricing = {
      'openai': {
        'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
        'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 }
      },
      'anthropic': {
        'claude-sonnet-4-20250514': { input: 0.003 / 1000, output: 0.015 / 1000 }
      },
      'openrouter': {
        'google/gemini-2.0-flash-exp:free': { input: 0, output: 0 },
        'deepseek/deepseek-chat': { input: 0.00014 / 1000, output: 0.00028 / 1000 }
      }
    };

    const modelPricing = pricing[provider]?.[model] || { input: 0, output: 0 };
    
    return (
      (usage?.prompt_tokens || usage?.input_tokens || 0) * modelPricing.input +
      (usage?.completion_tokens || usage?.output_tokens || 0) * modelPricing.output
    );
  }

  /**
   * Track metrics
   */
  trackMetrics(result, latency) {
    this.metrics.totalCalls++;
    this.metrics.totalTokensIn += result.tokensIn;
    this.metrics.totalTokensOut += result.tokensOut;
    this.metrics.totalCost += result.cost;
    this.metrics.totalLatency += latency;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.totalCalls > 0 ? this.metrics.totalLatency / this.metrics.totalCalls : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      totalLatency: 0
    };
  }
}

export default ModelRouter;

