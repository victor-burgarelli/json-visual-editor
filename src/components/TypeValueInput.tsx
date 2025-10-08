import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

// Ícones minimalistas para cada tipo
function TypeIcon({ type }: { type: string }) {
  const props = { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "inline-block mr-1" };
  
  switch(type) {
    case 'string':
      return <svg {...props}><path d="M3 7h3m14 0h-3m-8 6h8m-8 6h8M3 13h3m12 0h3M3 19h3m12 0h3" /></svg>;
    case 'number':
      return <svg {...props}><path d="M9 7h6m-6 10h6m2-7l-4 7m-4-7l4 7" /></svg>;
    case 'boolean':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'null':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 8v8m-4-4h8" opacity="0.3" /></svg>;
    case 'object':
      return <svg {...props}><path d="M7 8h10M7 12h10M7 16h10M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /></svg>;
    case 'array':
      return <svg {...props}><path d="M9 3H5v18h4M15 3h4v18h-4M10 9h4M10 15h4" /></svg>;
    default:
      return null;
  }
}

const typeOptions = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "null", label: "Null" },
  { value: "object", label: "Objeto" },
  { value: "array", label: "Array" },
];

// Controle global para fechar outros dropdowns
let globalCloseCallback: (() => void) | null = null;

export function TypeValueInput({
  value,
  type,
  onTypeChange,
  onValueChange,
  onConfirm,
  confirmLabel = "Adicionar",
  autoFocus = false,
  compact = false,
}: {
  value: any;
  type: string;
  onTypeChange: (type: string) => void;
  onValueChange: (value: any) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  // Registra callback para fechar este dropdown
  useEffect(() => {
    if (isOpen) {
      // Fecha qualquer outro dropdown aberto
      if (globalCloseCallback) {
        globalCloseCallback();
      }
      // Registra este dropdown como o ativo
      globalCloseCallback = () => setIsOpen(false);
    }
    return () => {
      if (globalCloseCallback === (() => setIsOpen(false))) {
        globalCloseCallback = null;
      }
    };
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);
  
  return (
    <div className={"flex items-center gap-2 " + (compact ? "" : "mb-2")}> 
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          className="border rounded px-2 py-1 text-sm flex items-center gap-1 bg-background hover:bg-accent min-w-[120px] justify-between"
          onClick={() => setIsOpen(!isOpen)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        >
          <span className="flex items-center gap-1">
            <TypeIcon type={type} />
            {typeOptions.find(opt => opt.value === type)?.label}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {isOpen && createPortal(
          <div 
            className="fixed border rounded bg-background shadow-lg min-w-[120px]"
            style={{ 
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 99999
            }}
          >
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                className="w-full px-2 py-1.5 text-sm flex items-center gap-1 hover:bg-accent text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTypeChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <TypeIcon type={opt.value} />
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      {type === "string" && (
        <Input
          autoFocus={autoFocus}
          value={value ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
          className="w-32"
        />
      )}
      {type === "number" && (
        <Input
          type="number"
          autoFocus={autoFocus}
          value={value ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(Number(e.target.value))}
          className="w-24"
        />
      )}
      {type === "boolean" && (
        <div className="flex items-center gap-1">
          <Switch
            checked={!!value}
            onCheckedChange={onValueChange}
          />
          <span className="text-xs">{value ? "true" : "false"}</span>
        </div>
      )}
      {type === "null" && (
        <span className="text-muted-foreground text-xs">null</span>
      )}
      {type === "object" && (
        <span className="text-muted-foreground text-xs">&#123; &#125;</span>
      )}
      {type === "array" && (
        <span className="text-muted-foreground text-xs">[ ]</span>
      )}
      <Button size="sm" className="leading-none" onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  );
}
