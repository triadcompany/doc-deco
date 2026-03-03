import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, Trash2, Palette } from 'lucide-react';
import { NODE_COLORS, type MindMapNodeData } from './types';

interface Props extends NodeProps {
  data: MindMapNodeData;
}

function MindMapCustomNodeInner({ id, data, selected }: Props) {
  const [editing, setEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const dispatchUpdate = useCallback(
    (newData: Partial<MindMapNodeData>) => {
      window.dispatchEvent(new CustomEvent('mindmap:update-node', { detail: { id, ...newData } }));
    },
    [id],
  );

  const handleDoubleClick = () => setEditing(true);

  const handleBlur = () => {
    setEditing(false);
    const val = inputRef.current?.value.trim();
    if (val && val !== data.label) dispatchUpdate({ label: val });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  const textColor = getContrastText(data.color);

  return (
    <div
      className="relative group rounded-lg shadow-md border border-white/20 min-w-[120px] max-w-[260px] transition-shadow"
      style={{ backgroundColor: data.color }}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-white/60" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/60" />

      <div className="px-3 py-2 flex items-center gap-1.5">
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={data.label}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-transparent outline-none text-sm w-full font-medium"
            style={{ color: textColor }}
          />
        ) : (
          <span className="text-sm font-medium leading-snug break-words" style={{ color: textColor }}>
            {data.label || 'Sem título'}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:scale-110 transition-transform"
          title="Adicionar filho"
          onClick={() => window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: id } }))}
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shadow hover:scale-110 transition-transform"
          title="Cor"
          onClick={() => setShowColors(!showColors)}
        >
          <Palette className="w-3 h-3" />
        </button>
        <button
          className="w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow hover:scale-110 transition-transform"
          title="Excluir"
          onClick={() => window.dispatchEvent(new CustomEvent('mindmap:delete-node', { detail: { id } }))}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Color palette */}
      {showColors && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-1 translate-y-full bg-popover border border-border rounded-lg p-1.5 flex gap-1 shadow-lg z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {NODE_COLORS.map((c) => (
            <button
              key={c}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
              style={{ backgroundColor: c, borderColor: c === data.color ? 'white' : 'transparent' }}
              onClick={() => {
                dispatchUpdate({ color: c });
                setShowColors(false);
              }}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="absolute inset-0 rounded-lg ring-2 ring-primary pointer-events-none" />
      )}
    </div>
  );
}

function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

export const MindMapCustomNode = memo(MindMapCustomNodeInner);
