declare global {
  namespace Express {
    interface Request {
      requestId: string;
      apiKey?: string;
      validated?: {
        body?: any;
        params?: any;
        query?: any;
      };
    }
  }
}

export {};
