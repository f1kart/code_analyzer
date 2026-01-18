import React from 'react';
import { getUndoRedoService, canUndo, canRedo, undoLastOperation, redoLastOperation } from '../services/UndoRedoService';

export interface UndoRedoPanelProps {
  className?: string;
}

export const UndoRedoPanel: React.FC<UndoRedoPanelProps> = ({ className = '' }) => {
  const undoRedoService = getUndoRedoService();
  const hasUndo = canUndo();
  const hasRedo = canRedo();

  const handleUndo = async () => {
    if (hasUndo) {
      await undoLastOperation();
    }
  };

  const handleRedo = async () => {
    if (hasRedo) {
      await redoLastOperation();
    }
  };

  if (!undoRedoService) {
    return null;
  }

  const state = undoRedoService.getState();
  const lastUndoable = undoRedoService.getLastUndoableOperation();
  const nextRedoable = undoRedoService.getNextRedoableOperation();

  return (
    <div className={`undo-redo-panel ${className}`}>
      <div className="undo-redo-controls">
        <button
          className={`undo-button ${!hasUndo ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!hasUndo}
          title={lastUndoable ? `Undo: ${lastUndoable.description}` : 'No actions to undo'}
        >
          ↶ Undo
        </button>

        <button
          className={`redo-button ${!hasRedo ? 'disabled' : ''}`}
          onClick={handleRedo}
          disabled={!hasRedo}
          title={nextRedoable ? `Redo: ${nextRedoable.description}` : 'No actions to redo'}
        >
          ↷ Redo
        </button>
      </div>

      <div className="undo-redo-info">
        <div className="operation-count">
          Operations: {state.operations.length} | Current: {state.currentIndex + 1}
        </div>

        {lastUndoable && (
          <div className="last-operation">
            Last: {lastUndoable.description}
          </div>
        )}
      </div>

      <style>{`
        .undo-redo-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          min-width: 200px;
        }

        .undo-redo-controls {
          display: flex;
          gap: 8px;
        }

        .undo-button,
        .redo-button {
          flex: 1;
          padding: 6px 12px;
          border: 1px solid #ced4da;
          background: #007bff;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .undo-button:hover:not(:disabled),
        .redo-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .undo-button:disabled,
        .redo-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .undo-redo-info {
          font-size: 11px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
          padding-top: 8px;
        }

        .operation-count {
          margin-bottom: 4px;
        }

        .last-operation {
          font-style: italic;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};
