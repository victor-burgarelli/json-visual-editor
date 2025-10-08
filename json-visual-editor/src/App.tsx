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
  isArray, 
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

function DeleteButton({ 
  onDelete,
  show = false
}: { 
  onDelete: () => void;
  show?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className={`ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 shadow-md transition-opacity ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      title="Remover item"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
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
  parentHovered = false
}: { 
  data: unknown; 
  level?: number; 
  path?: (string | number)[]; 
  onAdd?: (path: (string | number)[], key: string | number, value: any, type: string, insertPosition?: number) => void;
  onDelete?: (path: (string | number)[], key: string | number) => void;
  parentHovered?: boolean;
}) {
  const [showAddAt, setShowAddAt] = useState<number | null>(null);
  const [addType, setAddType] = useState("string");
  const [addValue, setAddValue] = useState<any>("");
  const [addKey, setAddKey] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Registra callback para fechar este formulário
  useEffect(() => {
    if (showAddAt !== null) {
      // Fecha qualquer outro formulário aberto
      if (globalCloseAddForm) {
        globalCloseAddForm();
      }
      // Registra este formulário como o ativo
      globalCloseAddForm = () => setShowAddAt(null);
    }
    return () => {
      if (globalCloseAddForm === (() => setShowAddAt(null))) {
        globalCloseAddForm = null;
      }
    };
  }, [showAddAt]);
  
  if (typeof data !== "object" || data === null) {
    return <span className={parentHovered ? 'bg-red-50 dark:bg-red-950/30 rounded px-1' : ''}>{JSON.stringify(data)}</span>;
  }
  
  const isArray = Array.isArray(data);
  const keys = isArray ? (data as unknown[]).map((_, i) => i) : Object.keys(data as Record<string, unknown>);
  
  const handleInsert = (position: number) => {
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
  };
  
  const handleDelete = (key: string | number) => {
    if (!onDelete) return;
    onDelete(path, key);
  };
  
  return (
    <div className="leading-relaxed">
      <span className="text-muted-foreground">{isArray ? "[" : "{"}</span>
      <div className="pl-4 border-l border-border/60 ml-1 mt-1">
        {keys.map((k, idx) => {
          const isItemHovered = hoveredIndex === idx;
          const shouldBeRed = parentHovered || isItemHovered;
          
          return (
            <div key={idx}>
              {/* Linha de inserção ANTES do item */}
              {onAdd && <InsertLine onInsert={handleInsert} isArray={isArray} position={idx} />}
              
              {/* Formulário de adição se esta posição foi selecionada */}
              {showAddAt === idx && (
                <div className="my-2 border-l-2 border-green-400 pl-2 bg-green-50 dark:bg-green-900/20 py-2 rounded relative z-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isArray && (
                      <input
                        className="border rounded px-2 py-1 text-xs w-32"
                        placeholder="nome da chave"
                        value={addKey}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddKey(e.target.value)}
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
                    />
                    <Button size="xs" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setShowAddAt(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
              
              {/* Conteúdo do item com hover vermelho */}
              <div className={`${shouldBeRed ? 'bg-red-50 dark:bg-red-950/30 rounded' : ''}`}>
                {/* Área de hover - apenas a linha do item, não os filhos */}
                <div 
                  className="text-sm py-0.5 group flex items-start transition-colors relative"
                  style={{ position: 'relative' }}
                >
                  {/* Camada invisível para capturar hover apenas da linha */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1.75rem', // Apenas a altura da primeira linha
                      zIndex: 1,
                      pointerEvents: 'auto'
                    }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                  
                  <div className="flex-1 min-w-0" style={{ pointerEvents: 'none', position: 'relative', zIndex: 2 }}>
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
                        parentHovered={isItemHovered}
                      />
                    </span>
                  </div>
                  {onDelete && (
                    <div 
                      style={{ position: 'relative', zIndex: 3, pointerEvents: 'auto' }}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <DeleteButton onDelete={() => handleDelete(k)} show={isItemHovered} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Linha de inserção APÓS o último item */}
        {onAdd && <InsertLine onInsert={handleInsert} isArray={isArray} position={keys.length} />}
        
        {/* Formulário de adição ao final */}
        {showAddAt === keys.length && (
          <div className="my-2 border-l-2 border-green-400 pl-2 bg-green-50 dark:bg-green-900/20 py-2 rounded relative z-50">
            <div className="flex items-center gap-2 flex-wrap">
              {!isArray && (
                <input
                  className="border rounded px-2 py-1 text-xs w-32"
                  placeholder="nome da chave"
                  value={addKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddKey(e.target.value)}
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
              />
              <Button size="xs" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setShowAddAt(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
      <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
    </div>
  );
}

export default function App() {
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
                      <JsonTree data={treeData ?? parsed.value} onAdd={handleAdd} onDelete={handleDelete} />
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
