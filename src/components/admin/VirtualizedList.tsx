import React, { useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FixedSizeList as List } from 'react-window';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import './AdminComponents.css';

// Virtualized list interface
export interface VirtualizedItem {
  id: string | number;
  [key: string]: any;
}

export interface VirtualizedListProps<T extends VirtualizedItem> {
  items: T[];
  itemHeight?: number | ((index: number) => number);
  height: number;
  renderItem: (item: T, index: number, style?: React.CSSProperties) => React.ReactNode;
  onLoadMore?: () => Promise<void> | void;
  hasMore?: boolean;
  isLoading?: boolean;
  estimateItemSize?: (index: number) => number;
  overscan?: number;
  className?: string;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
}

// Fixed size virtualized list
export const VirtualizedList = <T extends VirtualizedItem>({
  items,
  itemHeight = 50,
  height,
  renderItem,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  overscan = 5,
  className = '',
  emptyState,
  loadingState,
}: VirtualizedListProps<T>) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasMore ? items.length + 1 : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight as number,
    overscan,
  });

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      
      if (!item && hasMore && index === items.length) {
        return (
          <div style={style} className="flex items-center justify-center p-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="loading-spinner" />
                Loading more...
              </div>
            ) : (
              <button
                onClick={onLoadMore}
                className="text-sm text-brand-blue hover:text-blue-600"
              >
                Load more
              </button>
            )}
          </div>
        );
      }

      if (!item) return null;

      return <div style={style}>{renderItem(item, index, style)}</div>;
    },
    [items, renderItem, hasMore, isLoading, onLoadMore]
  );

  if (items.length === 0 && !isLoading) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div
      ref={parentRef}
      className={`virtual-list-container ${className}`}
      style={{ height }}
    >
      <div
        className="virtual-list-inner"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.index}
            className="virtual-item"
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <Row index={virtualItem.index} style={virtualItem.style} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Variable size virtualized list
export const VariableVirtualizedList = <T extends VirtualizedItem>({
  items,
  itemHeight,
  height,
  renderItem,
  overscan = 5,
  className = '',
  emptyState,
}: VirtualizedListProps<T>) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const getItemSize = useCallback(
    (index: number) => {
      if (typeof itemHeight === 'function') {
        return itemHeight(index);
      }
      return itemHeight as number;
    },
    [itemHeight]
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan,
  });

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      if (!item) return null;

      return <div style={style}>{renderItem(item, index, style)}</div>;
    },
    [items, renderItem]
  );

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div
      ref={parentRef}
      className={`virtual-list-container ${className}`}
      style={{ height }}
    >
      <div
        className="virtual-list-inner"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.index}
            className="virtual-item"
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <Row index={virtualItem.index} style={virtualItem.style} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Infinite scroll virtualized list
export const InfiniteVirtualizedList = <T extends VirtualizedItem>({
  items,
  itemHeight = 50,
  height,
  renderItem,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  overscan = 5,
  className = '',
  emptyState,
}: VirtualizedListProps<T>) => {
  // Count of items + 1 for the loading indicator
  const itemCount = hasMore ? items.length + 1 : items.length;

  const isItemLoaded = useCallback(
    (index: number) => {
      return !hasMore || index < items.length;
    },
    [hasMore, items.length]
  );

  const loadMoreItems = useCallback(
    (startIndex: number, stopIndex: number) => {
      if (onLoadMore && hasMore && !isLoading) {
        return onLoadMore();
      }
      return Promise.resolve();
    },
    [onLoadMore, hasMore, isLoading]
  );

  const Item = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      
      if (!item && hasMore && index === items.length) {
        return (
          <div style={style} className="flex items-center justify-center p-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="loading-spinner" />
                Loading more...
              </div>
            ) : (
              <button
                onClick={onLoadMore}
                className="text-sm text-brand-blue hover:text-blue-600"
              >
                Load more
              </button>
            )}
          </div>
        );
      }

      if (!item) return null;

      return <div style={style}>{renderItem(item, index, style)}</div>;
    },
    [items, renderItem, hasMore, isLoading, onLoadMore]
  );

  if (items.length === 0 && !isLoading) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
      threshold={3}
    >
      {({ onItemsRendered, ref }) => (
        <List
          ref={ref}
          height={height}
          itemCount={itemCount}
          itemSize={itemHeight}
          onItemsRendered={onItemsRendered}
          overscanCount={overscan}
          className={className}
        >
          {Item}
        </List>
      )}
    </InfiniteLoader>
  );
};

// Provider-specific virtualized list
export interface ProviderItem {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  baseUrl?: string;
  apiKeyRef: string;
  createdAt: Date;
  updatedAt: Date;
  status?: 'active' | 'inactive' | 'error';
}

export const VirtualizedProvidersList: React.FC<{
  providers: ProviderItem[];
  onDelete: (id: number) => void;
  onEdit?: (provider: ProviderItem) => void;
  height?: number;
}> = ({ providers, onDelete, onEdit, height = 400 }) => {
  const renderItem = useCallback(
    (provider: ProviderItem, index: number, style?: React.CSSProperties) => (
      <div
        style={style}
        className="flex items-center justify-between p-3 border-b border-border hover:bg-interactive transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-text-primary truncate">
              {provider.name}
            </h4>
            {provider.status && (
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  provider.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : provider.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {provider.status}
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {provider.provider} • {provider.modelId}
            {provider.baseUrl && ` • ${provider.baseUrl}`}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {onEdit && (
            <button
              onClick={() => onEdit(provider)}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
              title="Edit provider"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(provider.id)}
            className="p-1 text-text-secondary hover:text-brand-red transition-colors"
            title="Delete provider"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    ),
    [onDelete, onEdit]
  );

  return (
    <VirtualizedList
      items={providers}
      height={height}
      itemHeight={80}
      renderItem={renderItem}
      emptyState={
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-text-primary mb-1">No Providers</h3>
          <p className="text-xs text-text-secondary">Add your first model provider to get started.</p>
        </div>
      }
    />
  );
};

// Workflow-specific virtualized list
export interface WorkflowItem {
  id: number;
  name: string;
  definition: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  status?: 'active' | 'draft' | 'archived';
}

export const VirtualizedWorkflowsList: React.FC<{
  workflows: WorkflowItem[];
  onSelect: (workflow: WorkflowItem) => void;
  onDelete: (id: number) => void;
  selectedId?: number | null;
  height?: number;
}> = ({ workflows, onSelect, onDelete, selectedId, height = 400 }) => {
  const renderItem = useCallback(
    (workflow: WorkflowItem, index: number, style?: React.CSSProperties) => (
      <div
        style={style}
        className={`flex items-center justify-between p-3 border-b border-border cursor-pointer transition-colors ${
          selectedId === workflow.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-interactive'
        }`}
        onClick={() => onSelect(workflow)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-text-primary truncate">
              {workflow.name}
            </h4>
            {workflow.status && (
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  workflow.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : workflow.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {workflow.status}
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {Object.keys(workflow.definition).length} steps • Updated {workflow.updatedAt.toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(workflow.id);
          }}
          className="p-1 text-text-secondary hover:text-brand-red transition-colors ml-4"
          title="Delete workflow"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    ),
    [onSelect, onDelete, selectedId]
  );

  return (
    <VirtualizedList
      items={workflows}
      height={height}
      itemHeight={80}
      renderItem={renderItem}
      emptyState={
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-text-primary mb-1">No Workflows</h3>
          <p className="text-xs text-text-secondary">Create your first workflow to get started.</p>
        </div>
      }
    />
  );
};
