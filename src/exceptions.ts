export class LinkedInScraperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LinkedInScraperError'
    Object.setPrototypeOf(this, LinkedInScraperError.prototype)
  }
}

export class AuthenticationError extends LinkedInScraperError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

export class ElementNotFoundError extends LinkedInScraperError {
  constructor(message: string) {
    super(message)
    this.name = 'ElementNotFoundError'
    Object.setPrototypeOf(this, ElementNotFoundError.prototype)
  }
}

export class ProfileNotFoundError extends LinkedInScraperError {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileNotFoundError'
    Object.setPrototypeOf(this, ProfileNotFoundError.prototype)
  }
}

export class NetworkError extends LinkedInScraperError {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

export class ScrapingError extends LinkedInScraperError {
  constructor(message: string) {
    super(message)
    this.name = 'ScrapingError'
    Object.setPrototypeOf(this, ScrapingError.prototype)
  }
}

export class RateLimitError extends LinkedInScraperError {
  constructor(
    message: string,
    public suggestedWaitTime: number = 300,
  ) {
    super(message)
    this.name = 'RateLimitError'
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}
