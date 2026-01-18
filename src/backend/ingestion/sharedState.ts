import { PipelineSharedState } from './types.ts';

export class MapPipelineSharedState implements PipelineSharedState {
  private readonly store = new Map<string, unknown>();

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  entries(): [string, unknown][] {
    return Array.from(this.store.entries());
  }
}

export const createSharedState = (): PipelineSharedState => new MapPipelineSharedState();
