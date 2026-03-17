import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, Trash2, Palette } from 'lucide-react';
import { NODE_COLORS, type MindMapNodeData, type NodeShape } from './types';

interface Props extends NodeProps {
  data: MindMapNodeData & { nodeShape?: NodeShape };
}

function MindMapCustomNodeInner({ id, data, selected }: Props) {
  const [editing, setEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shape: NodeShape = data.nodeShape || 'rounded';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      autoResize(inputRef.current);
    }
  }, [editing]);

  useEffect(() => {
    const handleStartEdit = (e: Event) => {
      if ((e as CustomEvent).detail?.id === id) {
        setEditing(true);
      }
    };
    window.addEventListener('mindmap:start-edit', handleStartEdit);
    return () => window.removeEventListener('mindmap:start-edit', handleStartEdit);
  }, [id]);

  const dispatchUpdate = useCallback(
    (newData: Partial<MindMapNodeData>) => {
      window.dispatchEvent(new CustomEvent('mindmap:update-node', { detail: { id, ...newData } }));
    },
    [id],
  );

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    const val = inputRef.current?.value.trim();
    if (val && val !== data.label) dispatchUpdate({ label: val });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).blur();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
    e.stopPropagation();
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const bgColor = data.color || '#0d9488';
  const textColor = getContrastText(bgColor);
  const borderColor = adjustBrightness(bgColor, -30);

  // Shape-specific styles
  const shapeClasses = shape === 'rectangle' ? 'rounded-md' : 'rounded-xl';
  const shapeStyle: React.CSSProperties = { backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}` };
  const labelColor = textColor;

  return (
    <div
      className={`
        relative group min-w-[100px] max-w-[280px] transition-all duration-200
        ${shapeClasses}
        ${selected ? 'shadow-lg scale-[1.02]' : 'shadow-md hover:shadow-lg'}
      `}
      style={shapeStyle}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-white/80 !border-2 !-left-1.5 hover:!scale-125 transition-transform"
        style={{ borderColor: borderColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-white/80 !border-2 !-right-1.5 hover:!scale-125 transition-transform"
        style={{ borderColor: borderColor }}
      />

      {/* Content */}
      <div className="flex items-start gap-2 px-3.5 py-2.5">
        {editing ? (
          <textarea
            ref={inputRef}
            defaultValue={data.label}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onInput={(e) => autoResize(e.currentTarget)}
            className="bg-white/15 backdrop-blur-sm rounded-md outline-none text-sm w-full font-medium resize-none px-1.5 py-0.5 min-h-[24px]"
            style={{ color: labelColor }}
            rows={1}
          />
        ) : (
          <span
            className="text-sm font-medium leading-relaxed break-words select-none"
            style={{ color: labelColor }}
          >
            {data.label || 'Duplo clique para editar'}
          </span>
        )}
      </div>

      {/* Floating actions */}
      <div
        className="absolute -top-2 right-0 translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-7 h-7 rounded-full bg-background text-foreground flex items-center justify-center shadow-md border border-border hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Adicionar filho (Tab)"
          onClick={() => window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: id } }))}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          className="w-7 h-7 rounded-full bg-background text-foreground flex items-center justify-center shadow-md border border-border hover:bg-accent transition-colors"
          title="Mudar cor"
          onClick={() => setShowColors(!showColors)}
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
        <button
          className="w-7 h-7 rounded-full bg-background text-destructive flex items-center justify-center shadow-md border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
          title="Excluir (Delete)"
          onClick={() => window.dispatchEvent(new CustomEvent('mindmap:delete-node', { detail: { id } }))}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Color palette popover */}
      {showColors && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full bg-popover border border-border rounded-xl p-2 flex gap-1.5 shadow-xl z-20 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {NODE_COLORS.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded-full border-2 transition-all hover:scale-125 hover:shadow-md"
              style={{
                backgroundColor: c,
                borderColor: c === data.color ? '#fff' : 'transparent',
                boxShadow: c === data.color ? `0 0 0 2px ${c}` : undefined,
              }}
              onClick={() => {
                dispatchUpdate({ color: c });
                setShowColors(false);
              }}
            />
          ))}
        </div>
      )}

      {/* Selection ring */}
      {selected && (
        <div
          className={`absolute inset-[-2px] pointer-events-none border-2 animate-in fade-in duration-150 ${shapeClasses}`}
          style={{ borderColor: borderColor }}
        />
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

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const MindMapCustomNode = memo(MindMapCustomNodeInner);
