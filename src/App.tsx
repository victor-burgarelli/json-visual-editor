
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Upload, Clipboard, Check, FileJson } from "lucide-react";
import { TypeValueInput } from "./components/TypeValueInput";

/**
 * JSON Editor – Versão mínima
 * Mantido: Nome, Editor, Visualizador, COPIAR / IMPORTAR / EXPORTAR
 * Removido: validação, beautify, minify, sort, busca, wrap, dark mode, tooltips, rodapé, etc.
 */

// Controle global para fechar outros formulários de adição
let globalCloseAddForm: (() => void) | null = null;
let lastRegisteredCloser: (() => void) | null = null;

function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? (JSON.parse(v) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  // persist, sem UI
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  return [value, setValue] as const;
}

function tryParseJSON<T = unknown>(text: string): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    const obj = JSON.parse(text) as T;
    return { ok: true, value: obj };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function InsertLine({ 
  onInsert, 
  isArray: _, 
  position 
}: { 
  onInsert: (position: number) => void; 
  isArray: boolean;
  position: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className="relative group -my-0.5 cursor-pointer"
      style={{ position: 'relative', zIndex: 10 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onInsert(position)}
    >
      <div className={`h-1 transition-all ${isHovered ? 'bg-green-200 dark:bg-green-800' : 'hover:bg-green-100 dark:hover:bg-green-900'}`}>
        {isHovered && (
          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-green-600 shadow-md pointer-events-none"
            title="Adicionar item aqui"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="M12 5v14"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ onDelete, onMouseEnter, onMouseLeave }: { onDelete: () => void, onMouseEnter?: () => void, onMouseLeave?: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="ml-2 text-gray-500 hover:text-red-600 rounded-full p-1 transition-colors"
      title="Remover item"
      aria-label="Remover item"
      style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M15 9l-6 6" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9l6 6" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}

function JsonTree({ 
  data, 
  level = 0, 
  path = [], 
  onAdd,
  onDelete,
  parentHovered = false,
  treeData,
  setTreeData,
  editingPath,
  setEditingPath,
  creatingPath,
  setCreatingPath
}: { 
  data: unknown; 
  level?: number; 
  path?: (string | number)[]; 
  onAdd?: (path: (string | number)[], key: string | number, value: any, type: string, insertPosition?: number) => void;
  onDelete?: (path: (string | number)[], key: string | number) => void;
  parentHovered?: boolean;
  treeData?: any;
  setTreeData?: (data: any) => void;
  editingPath?: string | null;
  setEditingPath?: (path: string | null) => void;
  creatingPath?: string | null;
  setCreatingPath?: (path: string | null) => void;
}) {
  const [deleteHoverIdx, setDeleteHoverIdx] = useState<number | null>(null);
  const [showAddAt, setShowAddAt] = useState<number | null>(null);
  const [addType, setAddType] = useState("string");
  const [addValue, setAddValue] = useState<any>("");
  const [addKey, setAddKey] = useState("");
  // Removido highlight por hover
  // Deve ser chamado sempre (mesma ordem de hooks) mesmo que nó seja primitivo
  const [expanded, setExpanded] = useState(true);
  
  // Registra callback para fechar este formulário
  useEffect(() => {
    if (showAddAt !== null) {
      // Fecha qualquer outro formulário aberto
      if (globalCloseAddForm) {
        globalCloseAddForm();
      }
      const closer = () => {
        setShowAddAt(null);
        setCreatingPath && setCreatingPath(null);
      };
      globalCloseAddForm = closer;
      lastRegisteredCloser = closer;
    }
    return () => {
      if (globalCloseAddForm === lastRegisteredCloser) {
        globalCloseAddForm = null;
        lastRegisteredCloser = null;
      }
    };
  }, [showAddAt, setCreatingPath]);
  
  // Edição inline de valores primitivos
  const pathKey = path.join("/");
  const [editValue, setEditValue] = useState<string>("");
  const [editType, setEditType] = useState("string");
  const [editKey, setEditKey] = useState<string>(path.length > 0 ? String(path[path.length - 1]) : "");

  if (typeof data !== "object" || data === null) {
    if (onAdd && onDelete && path.length > 0) {
      // Form de edição ativo
      if (editingPath === pathKey) {
        return (
          <div className="my-1 border-l-2 border-yellow-400 pl-2 bg-yellow-50 dark:bg-yellow-900/20 py-1 rounded relative">
            <div className="flex items-center gap-2 flex-wrap">
              {path.length > 0 && typeof path[path.length - 1] !== 'number' && (
                <input
                  value={editKey}
                  onChange={e => setEditKey(e.target.value)}
                  placeholder="chave"
                  className="border rounded px-2 py-1 text-xs w-32"
                />
              )}
              <TypeValueInput
                value={editValue}
                type={editType}
                onTypeChange={setEditType}
                onValueChange={setEditValue}
                onConfirm={() => {
                  handleEdit(path, editValue, editType, editKey);
                  setEditingPath && setEditingPath(null);
                }}
                confirmLabel="Salvar"
                autoFocus
                compact
              />
              <Button size="sm" variant="outline" onClick={() => setEditingPath && setEditingPath(null)}>Cancelar</Button>
            </div>
          </div>
        );
      }
      // Ítem clicável para iniciar edição
      return (
        <span
          className={parentHovered ? 'bg-red-50 dark:bg-red-950/30 rounded px-1 cursor-pointer' : 'cursor-pointer'}
          title="Clique para editar"
          onClick={() => {
            // Fecha qualquer formulário de adição aberto em qualquer lugar
            if (globalCloseAddForm) globalCloseAddForm();
            setEditValue(String(data));
            setEditType(typeof data);
            setEditKey(path.length > 0 ? String(path[path.length - 1]) : "");
            // Ao iniciar edição, encerra criação global
            setCreatingPath && setCreatingPath(null);
            setEditingPath && setEditingPath(pathKey);
          }}
          style={{ borderBottom: '1px dashed #888' }}
        >
          {JSON.stringify(data)}
        </span>
      );
    }
    return <span className={parentHovered ? 'bg-red-50 dark:bg-red-950/30 rounded px-1' : ''}>{JSON.stringify(data)}</span>;
  }


  // Função para editar valor existente
  function handleEdit(editPath: (string | number)[], value: any, type: string, newKey?: string) {
    if (!treeData || !setTreeData) return;
    let newData = JSON.parse(JSON.stringify(treeData));
    let target = newData;
    for (let i = 0; i < editPath.length - 1; i++) {
      target = target[editPath[i]];
    }
    const lastKey = editPath[editPath.length - 1];
    let v = value;
    if (type === "number") v = Number(value);
    if (type === "boolean") v = value === "true" || value === true;
    if (type === "null") v = null;
    if (type === "object") v = {};
    if (type === "array") v = [];
    if (newKey && typeof lastKey !== 'number' && newKey !== String(lastKey)) {
      if (Object.prototype.hasOwnProperty.call(target, newKey)) {
        alert('Já existe uma chave com esse nome.');
      } else {
        // Reconstruir objeto preservando ordem
        const parentPath = editPath.slice(0, -1);
        let parentRef = newData;
        for (let i = 0; i < parentPath.length; i++) {
          parentRef = parentRef[parentPath[i]];
        }
        if (parentRef && typeof parentRef === 'object' && !Array.isArray(parentRef)) {
          const oldObj = parentRef as Record<string, any>;
            const entries = Object.entries(oldObj);
            const rebuilt: Record<string, any> = {};
            for (const [kEntry, valEntry] of entries) {
              if (kEntry === String(lastKey)) {
                rebuilt[newKey] = v; // insere no mesmo lugar
              } else {
                rebuilt[kEntry] = valEntry;
              }
            }
            // substituir conteúdo mantendo mesma referência (mutação controlada)
            for (const kDel of Object.keys(oldObj)) delete oldObj[kDel];
            for (const [kAdd, vAdd] of Object.entries(rebuilt)) oldObj[kAdd] = vAdd;
        } else {
          // fallback (não esperado para arrays)
          target[newKey] = v;
          delete target[lastKey as string];
        }
      }
    } else {
      target[lastKey] = v;
    }
    setTreeData(newData);
    // Fecha edição em outros campos
    window.dispatchEvent(new CustomEvent('json-editor-close-edit'));
  }
  
  const isArray = Array.isArray(data);
  const keys = isArray ? (data as unknown[]).map((_, i) => i) : Object.keys(data as Record<string, unknown>);
  
  const handleInsert = (position: number) => {
    // Fecha edição ativa sempre que inicia criação
    setEditingPath && setEditingPath(null);
    // Sempre muda o ponto de criação (fecha anterior porque a condição de render depende de creatingPath)
    setCreatingPath && setCreatingPath(pathKey + ':' + position);
    // Garante que qualquer formulário anterior seja realmente fechado
    if (globalCloseAddForm && lastRegisteredCloser !== globalCloseAddForm) {
      globalCloseAddForm();
    }
    setShowAddAt(position);
    setAddType("string");
    setAddValue("");
    setAddKey("");
  };
  
  const handleConfirmAdd = (insertPosition: number) => {
    if (!onAdd) return;
    if (!isArray && !addKey.trim()) {
      alert("Digite o nome da chave");
      return;
    }
    onAdd(path, isArray ? insertPosition : addKey, addValue, addType, insertPosition);
    setShowAddAt(null);
    setAddValue("");
    setAddKey("");
    setCreatingPath && setCreatingPath(null);
    // Garante que qualquer referência global também seja limpa
  if (globalCloseAddForm) globalCloseAddForm();
  };
  
  const handleDelete = (key: string | number) => {
    if (!onDelete) return;
    onDelete(path, key);
  };
  
  // Estado de expansão por nó (hook já declarado acima)
  const canExpand = keys.length > 0;
  const toggleBtn = canExpand ? (
    <button
      onClick={() => setExpanded((v) => !v)}
      style={{ marginRight: 4, cursor: "pointer", background: "none", border: "none", outline: "none", display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      title={expanded ? "Minimizar" : "Expandir"}
      aria-label={expanded ? "Minimizar" : "Expandir"}
    >
      {expanded ? (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline'}}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline'}}>
          <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  ) : null;

  return (
    <div className="leading-relaxed">
      <span className="text-muted-foreground">{toggleBtn}{isArray ? "[" : "{"}</span>
      {expanded && (
        <div className="pl-4 border-l border-border/60 ml-1 mt-1">
          {keys.map((k, idx) => {
            // Sem lógica de hover destacado
            return (
              <div key={idx}>
                {onAdd && (
                  <InsertLine onInsert={handleInsert} isArray={isArray} position={idx} />
                )}
                {showAddAt === idx && creatingPath === pathKey + ':' + idx && (
                  <div className="my-2 border-l-2 border-green-400 pl-2 bg-green-50 dark:bg-green-900/20 py-2 rounded relative z-50">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isArray && (
                        <input
                          className="border rounded px-2 py-1 text-xs w-32"
                          placeholder="nome da chave"
                          value={addKey}
                          onChange={e => setAddKey(e.target.value)}
                          autoFocus
                        />
                      )}
                      <TypeValueInput
                        value={addValue}
                        type={addType}
                        onTypeChange={setAddType}
                        onValueChange={setAddValue}
                        onConfirm={() => handleConfirmAdd(idx)}
                        confirmLabel="Inserir"
                        autoFocus={isArray}
                        compact
                      />
                      <Button size="sm" variant="outline" onClick={() => { setShowAddAt(null); setCreatingPath && setCreatingPath(null); }}>Cancelar</Button>
                    </div>
                  </div>
                )}
                 <div className={deleteHoverIdx === idx ? 'bg-red-50/80 dark:bg-red-950/40 rounded' : ''}>
                   <div 
                     className="text-sm py-0.5 flex items-start relative"
                   >
                    <div className="flex-1 min-w-0" style={{ position: 'relative' }}>
                      <span style={{ pointerEvents: 'auto' }}>
                        {!isArray && <span className="text-sky-700 dark:text-sky-300 mr-1">"{String(k)}"</span>}
                        {!isArray && <span className="text-muted-foreground">:</span>}
                      </span>
                      <span className={!isArray ? "ml-1" : undefined} style={{ pointerEvents: 'auto' }}>
                        <JsonTree 
                          data={isArray ? (data as unknown[])[k as number] : (data as Record<string, unknown>)[k as string]} 
                          level={level + 1} 
                          path={[...path, k]}
                          onAdd={onAdd}
                          onDelete={onDelete}
                          parentHovered={false}
                          treeData={treeData}
                          setTreeData={setTreeData}
                          editingPath={editingPath}
                          setEditingPath={setEditingPath}
                          creatingPath={creatingPath}
                          setCreatingPath={setCreatingPath}
                        />
                      </span>
                    </div>
                     {onDelete && (
                       <div style={{ position: 'relative', zIndex: 3, pointerEvents: 'auto' }}>
                         <DeleteButton 
                           onDelete={() => handleDelete(k)} 
                           onMouseEnter={() => setDeleteHoverIdx(idx)}
                           onMouseLeave={() => setDeleteHoverIdx(null)}
                         />
                       </div>
                     )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Linha de inserção APÓS o último item */}
          {onAdd && (
            <InsertLine onInsert={handleInsert} isArray={isArray} position={keys.length} />
          )}
          {/* Formulário de adição ao final */}
          {showAddAt === keys.length && creatingPath === pathKey + ':' + keys.length && (
            <div className="my-2 border-l-2 border-green-400 pl-2 bg-green-50 dark:bg-green-900/20 py-2 rounded relative z-50">
              <div className="flex items-center gap-2 flex-wrap">
                {!isArray && (
                  <input
                    className="border rounded px-2 py-1 text-xs w-32"
                    placeholder="nome da chave"
                    value={addKey}
                    onChange={e => setAddKey(e.target.value)}
                    autoFocus
                  />
                )}
                <TypeValueInput
                  value={addValue}
                  type={addType}
                  onTypeChange={setAddType}
                  onValueChange={setAddValue}
                  onConfirm={() => handleConfirmAdd(keys.length)}
                  confirmLabel="Adicionar"
                  autoFocus={isArray}
                  compact
                />
                <Button size="sm" variant="outline" onClick={() => { setShowAddAt(null); setCreatingPath && setCreatingPath(null); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
      <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
    </div>
  );

}

export default function App() {
  // Controle global de edição/criação inline
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingPath, setCreatingPath] = useState<string | null>(null);
  const [raw, setRaw] = useLocalStorage(
    "jsoneditor:text",
    '{\n  "hello": "world",\n  "items": [1, 2, 3],\n  "nested": { "a": true, "b": null }\n}'
  );
  const parsed = useMemo(() => tryParseJSON(raw), [raw]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(raw));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const onDownload = () => {
    const name = `data-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const content = (() => {
      if (parsed.ok) return JSON.stringify(parsed.value, null, 2);
      return String(raw);
    })();
    downloadFile(name, content);
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    toast.success(`Carregado: ${file.name}`);
  };

  // Função para adicionar item ao JSON (apenas na visualização, não salva no editor)
  const [treeData, setTreeData] = useState<any>(null);
  // Atualiza treeData sempre que o JSON muda
  useMemo(() => {
    if (parsed.ok) setTreeData(parsed.value);
  }, [raw]);

  // Sincroniza treeData de volta para o editor
  useEffect(() => {
    if (treeData !== null) {
      const newText = JSON.stringify(treeData, null, 2);
      // Só atualiza se for diferente para evitar loop infinito
      if (newText !== JSON.stringify(parsed.ok ? parsed.value : null, null, 2)) {
        setRaw(newText);
      }
    }
  }, [treeData]);

  function handleAdd(path: (string | number)[], key: string | number, value: any, type: string, insertPosition?: number) {
    if (!treeData) return;
    let newData = JSON.parse(JSON.stringify(treeData));
    
    // Converte o valor de acordo com o tipo
    let v: any = value;
    if (type === "number") v = Number(value);
    if (type === "boolean") v = Boolean(value);
    if (type === "null") v = null;
    if (type === "object") v = {};
    if (type === "array") v = [];
    
    // Navega até o objeto/array correto usando o path
    let target = newData;
    for (const p of path) {
      target = target[p];
    }
    
    // Adiciona o novo valor
    if (Array.isArray(target)) {
      // Para arrays, insere na posição especificada
      if (insertPosition !== undefined) {
        target.splice(insertPosition, 0, v);
      } else {
        target.push(v);
      }
    } else if (typeof target === "object" && target !== null) {
      // Para objetos, adiciona a chave
      target[key] = v;
      
      // Se uma posição foi especificada, reordena as chaves
      if (insertPosition !== undefined) {
        const keys = Object.keys(target);
        const newObj: any = {};
        let insertedKey = false;
        
        keys.forEach((k, idx) => {
          if (idx === insertPosition && !insertedKey) {
            newObj[key] = v;
            insertedKey = true;
          }
          if (k !== String(key)) {
            newObj[k] = target[k];
          }
        });
        
        // Se ainda não inseriu (posição no final)
        if (!insertedKey) {
          newObj[key] = v;
        }
        
        // Atualiza o target com o objeto reordenado
        Object.keys(target).forEach(k => delete target[k]);
        Object.assign(target, newObj);
      }
    }
    
    setTreeData(newData);
  }

  function handleDelete(path: (string | number)[], key: string | number) {
    if (!treeData) return;
    let newData = JSON.parse(JSON.stringify(treeData));
    
    // Navega até o objeto/array pai correto usando o path
    let target = newData;
    for (const p of path) {
      target = target[p];
    }
    
    // Remove o item
    if (Array.isArray(target)) {
      target.splice(key as number, 1);
    } else if (typeof target === "object" && target !== null) {
      delete target[key];
    }
    
    setTreeData(newData);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        {/* Header simples: nome + ações (Copiar / Exportar / Importar) */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileJson className="w-6 h-6" />
            <h1 className="text-xl font-semibold">JSON Editor</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCopy}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Clipboard className="w-4 h-4 mr-1" />}Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4 mr-1" />Exportar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />Importar
            </Button>
          </div>
        </header>

        {/* Conteúdo: Editor (esquerda) e Visualizador (direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="h-[75vh] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Editor</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className={`flex-1 rounded-xl border bg-background overflow-hidden`}>
                <Textarea
                  value={String(raw)}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRaw(e.target.value)}
                  className={`h-full resize-none font-mono text-[13px] leading-5 whitespace-pre-wrap`}
                  placeholder="Cole seu JSON aqui…"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="text-muted-foreground">{String(raw).length.toLocaleString()} caracteres</div>
                {parsed.ok ? (
                  <div className="text-emerald-600 dark:text-emerald-400">JSON válido</div>
                ) : (
                  <div className="text-red-600 dark:text-red-400 truncate max-w-[70%]" title={parsed.error.message}>
                    Erro: {parsed.error.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-[75vh] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Visualizador</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <Tabs defaultValue="tree" className="h-full flex flex-col">
                <TabsList className="self-start">
                  <TabsTrigger value="tree">Árvore</TabsTrigger>
                  <TabsTrigger value="pretty">Pretty JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="tree" className="flex-1 overflow-auto">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    {parsed.ok ? (
                      <JsonTree 
                        data={treeData ?? parsed.value} 
                        onAdd={handleAdd} 
                        onDelete={handleDelete} 
                        treeData={treeData ?? parsed.value} 
                        setTreeData={setTreeData}
                        editingPath={editingPath}
                        setEditingPath={setEditingPath}
                        creatingPath={creatingPath}
                        setCreatingPath={setCreatingPath}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">Corrija o JSON para visualizar…</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="pretty" className="h-full overflow-auto">
                  <pre className="rounded-lg border p-3 bg-muted/30 text-sm leading-6 overflow-auto">
                    {parsed.ok ? JSON.stringify(treeData ?? parsed.value, null, 2) : "Corrija o JSON para visualizar…"}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
