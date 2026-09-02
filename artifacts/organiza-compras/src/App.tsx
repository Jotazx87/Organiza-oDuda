import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  History,
  LogOut,
  Paperclip,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import * as XLSX from "xlsx";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ExportInputFormat,
  PurchaseInputPaymentMethod,
  PurchaseInputSource,
  PurchaseStatus,
  getDownloadAttachmentQueryKey,
  getGetDashboardSummaryQueryKey,
  getListAttachmentsQueryKey,
  getListExportHistoryQueryKey,
  getListPurchasesQueryKey,
  useCreateAttachment,
  useCreateExportRecord,
  useCreatePurchase,
  useDeleteAttachment,
  useDeletePurchase,
  useGetDashboardSummary,
  useHealthCheck,
  useListAttachments,
  useListExportHistory,
  useListPurchases,
  useLogin,
  useUpdatePurchase,
  useDownloadAttachment,
  type Attachment,
  type Purchase,
  type PurchaseInput,
} from "@workspace/api-client-react";

const queryClient = new QueryClient();
type Tab = "overview" | "purchases" | "add" | "attachments" | "history";
type FormState = {
  purchaseDate: string;
  deliveryDate: string;
  supplier: string;
  productName: string;
  recipient: string;
  base: string;
  quantity: string;
  totalValue: string;
  paymentMethod: PurchaseInputPaymentMethod;
  status: PurchaseStatus;
};

const todayInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");
const formatDate = (value?: string | null) => {
  if (!value) return "Sem previsão";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(".", "");
};
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "")
    : "—";
const statusLabel: Record<string, string> = { pending: "A caminho", delivered: "Entregue", overdue: "Atrasada" };
const initialForm: FormState = {
  purchaseDate: todayInputValue(),
  deliveryDate: "",
  supplier: "",
  productName: "",
  recipient: "Duda",
  base: "",
  quantity: "1",
  totalValue: "",
  paymentMethod: PurchaseInputPaymentMethod.not_informed,
  status: PurchaseStatus.pending,
};

const paymentLabels: Record<string, string> = {
  not_informed: "Não informada",
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  boleto: "Boleto",
  cash: "Dinheiro",
  other: "Outra",
};
const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <AuthenticatedApp />
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedApp() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem("organiza-auth") === "true");
  if (!authenticated) {
    return <LoginScreen onLogin={() => { localStorage.setItem("organiza-auth", "true"); setAuthenticated(true); }} />;
  }
  return <Workspace onLogout={() => { localStorage.removeItem("organiza-auth"); setAuthenticated(false); }} />;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const login = useLogin();
  const [username, setUsername] = useState("Duda");
  const [password, setPassword] = useState("duo");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    login.mutate({ data: { username: username.trim(), password } }, {
      onSuccess: (result) => result.authenticated ? onLogin() : setError("Confira usuário e senha para entrar."),
      onError: () => setError("Não foi possível entrar agora. Tente novamente em instantes."),
    });
  };
  return (
    <main className="app-noise min-h-[100dvh] bg-[#0f172a] text-[#f8fafc] lg:grid lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden overflow-hidden border-r border-[#334155] p-12 lg:flex lg:flex-col lg:justify-between xl:p-20">
        <div className="absolute -right-24 -top-32 h-[480px] w-[480px] rounded-full border-[80px] border-[#6366f1]/10" />
        <Brand light />
        <div className="relative max-w-xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[.2em] text-[#818cf8]">Caderno de compras · Duda</p>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-.06em] text-[#f8fafc] xl:text-7xl">Tudo que você compra, <span className="text-[#818cf8]">no lugar certo.</span></h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-[#94a3b8]">Pedidos organizados, documentos anexados e uma busca que encontra o que você precisa sem abrir dez abas.</p>
          <div className="mt-12 flex max-w-sm items-center gap-4 border-t border-[#334155] pt-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#818cf8]/40 text-lg text-[#818cf8]">"</span>
            <p className="text-xs leading-5 text-[#94a3b8]">Um cantinho confiável para lembrar do que importa.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#94a3b8]"><ShieldCheck size={17} className="text-[#10b981]" /> Seus dados ficam só no seu espaço.</div>
      </section>
      <section className="flex min-h-[100dvh] items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[410px] animate-rise">
          <div className="mb-14 lg:hidden"><Brand /></div>
          <div className="mb-9">
            <p className="mono mb-3 text-[11px] uppercase tracking-[.18em] text-[#818cf8]">Bem-vinda de volta</p>
            <h2 className="text-3xl font-extrabold tracking-[-.05em] text-[#f8fafc]">Acesse seu espaço.</h2>
            <p className="mt-3 text-sm leading-6 text-[#94a3b8]">Entre para cuidar das compras da Duda com clareza.</p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Usuário" value={username} onChange={setUsername} placeholder="Duda" testId="input-username" autoComplete="username" />
            <Field label="Senha" value={password} onChange={setPassword} placeholder="duo" type="password" testId="input-password" autoComplete="current-password" />
            {error && <InlineError testId="status-login-error">{error}</InlineError>}
            <button data-testid="button-login" disabled={login.isPending} className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] font-bold text-[#f8fafc] shadow-[0_10px_24px_rgba(99,102,241,.22)] transition hover:bg-[#818cf8] disabled:opacity-60">
              {login.isPending ? "Entrando…" : "Entrar no meu espaço"} {!login.isPending && <ChevronRight size={18} />}
            </button>
          </form>
          <div className="mt-12 border-t border-[#334155] pt-5 text-xs text-[#64748b]">Organiza Compras · privado</div>
        </div>
      </section>
    </main>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-brand" className={`flex w-fit items-center gap-3 ${light ? "text-[#f8fafc]" : "text-[#f8fafc]"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6366f1] text-[#f8fafc] shadow-[0_8px_20px_rgba(99,102,241,.2)]"><Package size={20} strokeWidth={2.4} /></span><span className="text-lg font-extrabold tracking-[-.05em]">organiza<span className="text-[#818cf8]">.</span></span></Link>;
}

function Workspace({ onLogout }: { onLogout: () => void }) {
  const healthQuery = useHealthCheck();
  const [location, setLocation] = useLocation();
  const path = location.split("?")[0];
  const legacyTab = new URLSearchParams(location.split("?")[1] ?? "").get("tab");
  const tab: Tab = path === "/purchases" ? "purchases" : path === "/add" ? "add" : path === "/attachments" ? "attachments" : path === "/history" ? "history" : legacyTab === "purchases" || legacyTab === "add" || legacyTab === "attachments" || legacyTab === "history" ? legacyTab : "overview";
  const go = (next: Tab) => {
    const path = next === "overview" ? "/" : `/${next}`;
    setLocation(path);
  };
  return (
    <div className="app-noise app-shell paper-grid min-h-[100dvh] bg-[#0f172a] text-[#f8fafc]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1600px]">
        <aside className="hidden w-[260px] shrink-0 border-r border-[#334155] bg-[#0f172a] px-5 py-7 md:flex md:flex-col">
          <Brand />
          <p className="mono mt-16 px-3 text-[10px] uppercase tracking-[.2em] text-[#64748b]">Meu espaço</p>
          <nav className="mt-4 space-y-1">
            <NavButton active={tab === "overview"} icon={<BarChart3 size={18} />} label="Visão geral" onClick={() => go("overview")} testId="nav-overview" />
            <NavButton active={tab === "purchases"} icon={<ClipboardList size={18} />} label="Todas as compras" onClick={() => go("purchases")} testId="nav-purchases" />
            <NavButton active={tab === "attachments"} icon={<Paperclip size={18} />} label="Anexos" onClick={() => go("attachments")} testId="nav-attachments" />
            <NavButton active={tab === "add"} icon={<Plus size={18} />} label="Adicionar compra" onClick={() => go("add")} testId="nav-add" />
            <NavButton active={tab === "history"} icon={<History size={18} />} label="Histórico de exportações" onClick={() => go("history")} testId="nav-history" />
          </nav>
          <div className="mt-auto rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-[#3730a3] text-xs font-extrabold text-[#e0e7ff]">DU</div>
            <p className="text-sm font-bold text-[#f8fafc]">Duda</p>
            <p className="mt-1 text-xs text-[#94a3b8]">Organizador pessoal</p>
            <button data-testid="button-logout" onClick={onLogout} className="focus-ring mt-4 flex items-center gap-2 text-xs font-bold text-[#94a3b8] transition hover:text-[#f8fafc]"><LogOut size={14} /> Sair</button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-[#334155] bg-[#0f172a]/95 px-5 backdrop-blur sm:px-8 lg:px-12">
            <div className="md:hidden"><Brand /></div>
            <div className="hidden md:block"><p className="mono text-[10px] uppercase tracking-[.2em] text-[#64748b]">Seu caderno de compras</p><p className="mt-1 text-sm font-bold text-[#cbd5e1]">Tudo no seu tempo, tudo no lugar.</p></div>
            <div className="flex items-center gap-3">
               <div data-testid="status-sync" className="hidden items-center gap-2 rounded-lg border border-[#334155] px-3 py-2 text-xs text-[#94a3b8] sm:flex"><span className={`h-2 w-2 rounded-full ${healthQuery.isError ? "bg-[#f59e0b]" : "bg-[#10b981]"}`} /> {healthQuery.isLoading ? "Sincronizando…" : healthQuery.isError ? "Modo offline" : "Dados sincronizados"}</div>
              <button data-testid="button-header-add" onClick={() => go("add")} className="focus-ring flex h-10 items-center gap-2 rounded-xl bg-[#6366f1] px-4 text-sm font-bold text-[#f8fafc] shadow-[0_8px_18px_rgba(99,102,241,.2)] transition hover:bg-[#818cf8]"><Plus size={17} /> <span className="hidden sm:inline">Nova compra</span></button>
              <button data-testid="button-mobile-logout" onClick={onLogout} aria-label="Sair" className="grid h-10 w-10 place-items-center rounded-xl border border-[#334155] text-[#94a3b8] md:hidden"><LogOut size={16} /></button>
            </div>
          </header>
          <main className="px-5 py-8 pb-28 sm:px-8 lg:px-12 lg:py-11">
            {tab === "overview" && <Overview onAdd={() => go("add")} onAll={() => go("purchases")} onAttachments={() => go("attachments")} onHistory={() => go("history")} />}
            {tab === "purchases" && <AllPurchases onAdd={() => go("add")} />}
            {tab === "attachments" && <AttachmentsPage />}
            {tab === "add" && <PurchaseEntry onDone={() => go("overview")} />}
            {tab === "history" && <ExportHistory />}
          </main>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-[70px] items-center justify-around border-t border-[#334155] bg-[#0f172a]/95 px-2 backdrop-blur md:hidden">
        <MobileNav active={tab === "overview"} icon={<BarChart3 size={19} />} label="Início" onClick={() => go("overview")} testId="mobile-nav-overview" />
        <MobileNav active={tab === "purchases"} icon={<ClipboardList size={19} />} label="Compras" onClick={() => go("purchases")} testId="mobile-nav-purchases" />
        <MobileNav active={tab === "attachments"} icon={<Paperclip size={19} />} label="Anexos" onClick={() => go("attachments")} testId="mobile-nav-attachments" />
        <MobileNav active={tab === "add"} icon={<Plus size={21} />} label="Adicionar" onClick={() => go("add")} testId="mobile-nav-add" />
        <MobileNav active={tab === "history"} icon={<History size={19} />} label="Exportar" onClick={() => go("history")} testId="mobile-nav-history" />
      </nav>
    </div>
  );
}

function NavButton({ active, icon, label, onClick, testId }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; testId: string }) {
  return <button data-testid={testId} onClick={onClick} className={`focus-ring group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[#6366f1] text-[#f8fafc] shadow-[0_8px_18px_rgba(99,102,241,.2)]" : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#f8fafc]"}`}>{icon}<span>{label}</span>{active && <ChevronRight size={15} className="ml-auto opacity-70" />}</button>;
}
function MobileNav({ active, icon, label, onClick, testId }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; testId: string }) {
  return <button data-testid={testId} onClick={onClick} className={`focus-ring flex min-w-[54px] flex-col items-center gap-1 text-[10px] font-bold ${active ? "text-[#818cf8]" : "text-[#64748b]"}`}>{icon}<span>{label}</span></button>;
}

function Overview({ onAdd, onAll, onAttachments, onHistory }: { onAdd: () => void; onAll: () => void; onAttachments: () => void; onHistory: () => void }) {
  const queryClient = useQueryClient();
  const summaryQuery = useGetDashboardSummary();
  const purchasesQuery = useListPurchases();
  const attachmentsQuery = useListAttachments();
  const del = useDeletePurchase();
  const update = useUpdatePurchase();
  const [editing, setEditing] = useState<Purchase | null>(null);
  const summary = summaryQuery.data;
  const purchases = purchasesQuery.data ?? summary?.recent ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const remove = (purchase: Purchase) => { if (window.confirm(`Excluir "${purchase.productName}"?`)) del.mutate({ id: purchase.id }, { onSuccess: refresh }); };
  const markDelivered = (purchase: Purchase) => update.mutate({ id: purchase.id, data: { status: PurchaseStatus.delivered } }, { onSuccess: refresh });
  return <div className="mx-auto max-w-[1240px]">
    <div className="animate-rise flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono text-[11px] uppercase tracking-[.2em] text-[#818cf8]">Visão geral</p><h1 data-testid="text-page-title" className="mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc] sm:text-[42px]">Olá, Duda<span className="text-[#818cf8]">.</span></h1><p className="mt-2 text-sm text-[#94a3b8]">Um panorama do que está chegando e do que já chegou.</p></div><div className="flex gap-2 self-start sm:self-auto"><button onClick={onHistory} className="focus-ring flex items-center gap-2 rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-2.5 text-sm font-bold text-[#cbd5e1] transition hover:border-[#6366f1] hover:text-[#f8fafc]"><Download size={16} /> Exportações</button><button onClick={onAttachments} className="focus-ring flex items-center gap-2 rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-2.5 text-sm font-bold text-[#cbd5e1] transition hover:border-[#6366f1] hover:text-[#f8fafc]"><Paperclip size={16} /> Anexos</button><button data-testid="button-overview-add" onClick={onAdd} className="focus-ring grid h-10 w-10 place-items-center rounded-xl bg-[#6366f1] text-[#f8fafc] transition hover:bg-[#818cf8]" title="Adicionar compra"><Plus size={17} /></button></div></div>
    <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Total de compras" value={summary?.total ?? 0} icon={<ClipboardList size={18} />} tone="indigo" loading={summaryQuery.isLoading} testId="stat-total" />
      <StatCard label="A caminho" value={summary?.pending ?? 0} icon={<Truck size={18} />} tone="amber" loading={summaryQuery.isLoading} testId="stat-pending" />
      <StatCard label="Entregues" value={summary?.delivered ?? 0} icon={<PackageCheck size={18} />} tone="green" loading={summaryQuery.isLoading} testId="stat-delivered" />
      <StatCard label="Este mês" value={summary?.thisMonth ?? 0} icon={<CalendarDays size={18} />} tone="slate" loading={summaryQuery.isLoading} testId="stat-month" />
      <StatCard label="Anexos" value={attachmentsQuery.data?.length ?? 0} icon={<Paperclip size={18} />} tone="violet" loading={attachmentsQuery.isLoading} testId="stat-attachments" />
    </div>
    <section className="mt-9 overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] shadow-[0_18px_40px_rgba(2,6,23,.2)]">
      <div className="flex flex-col justify-between gap-4 border-b border-[#334155] px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><h2 className="text-lg font-extrabold tracking-[-.03em] text-[#f8fafc]">Atividade recente</h2><p className="mt-1 text-xs text-[#94a3b8]">Os últimos pedidos registrados no seu espaço.</p></div><button onClick={onAll} className="flex items-center gap-1 self-start text-xs font-bold text-[#818cf8] transition hover:text-[#a5b4fc]">Ver todas as compras <ChevronRight size={14} /></button></div>
      {purchasesQuery.isLoading ? <PurchaseSkeleton /> : purchasesQuery.isError ? <ErrorState onRetry={() => purchasesQuery.refetch()} /> : purchases.length === 0 ? <EmptyPurchases onAdd={onAdd} /> : <div className="divide-y divide-[#334155]">{purchases.slice(0, 6).map((purchase) => <PurchaseRow key={purchase.id} purchase={purchase} onEdit={() => setEditing(purchase)} onDelete={() => remove(purchase)} onDelivered={() => markDelivered(purchase)} busy={del.isPending || update.isPending} />)}</div>}
    </section>
    {summary?.overdue ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-5 py-4 text-sm text-[#fcd34d]"><AlertCircle size={18} /><span><strong>{summary.overdue} compra{summary.overdue > 1 ? "s" : ""}</strong> passou do prazo previsto. Vale conferir.</span></div> : null}
    {editing && <EditModal purchase={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
  </div>;
}

function StatCard({ label, value, icon, tone, loading, testId }: { label: string; value: number; icon: ReactNode; tone: string; loading: boolean; testId: string }) {
  const tones: Record<string, string> = { indigo: "bg-[#6366f1]/15 text-[#a5b4fc]", amber: "bg-[#f59e0b]/15 text-[#fbbf24]", green: "bg-[#10b981]/15 text-[#34d399]", slate: "bg-[#334155] text-[#cbd5e1]", violet: "bg-[#a855f7]/15 text-[#d8b4fe]" };
  return <div data-testid={testId} className="rounded-xl border border-[#334155] bg-[#1e293b] p-5 shadow-[0_12px_28px_rgba(2,6,23,.14)]"><div className={`mb-5 grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}>{icon}</div>{loading ? <div className="skeleton h-9 w-14 rounded-lg" /> : <p data-testid={`${testId}-value`} className="text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc]">{value}</p>}<p className="mt-1 text-xs font-semibold text-[#94a3b8]">{label}</p></div>;
}

function PurchaseRow({ purchase, onEdit, onDelete, onDelivered, busy }: { purchase: Purchase; onEdit: () => void; onDelete: () => void; onDelivered: () => void; busy: boolean }) {
  const delivered = purchase.status === PurchaseStatus.delivered;
  return <article data-testid={`card-purchase-${purchase.id}`} className="group flex flex-col gap-4 px-5 py-5 transition hover:bg-[#243249] sm:flex-row sm:items-center sm:px-7"><div className="flex min-w-0 flex-1 items-center gap-4"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${delivered ? "bg-[#10b981]/15 text-[#34d399]" : "bg-[#6366f1]/15 text-[#a5b4fc]"}`}><PackageCheck size={19} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-extrabold text-[#f8fafc]">{purchase.productName}</h3><StatusBadge status={purchase.status} /></div><p className="mt-1 truncate text-xs text-[#94a3b8]">{purchase.supplier} <span className="mx-1 text-[#475569]">·</span> Solicitante: {purchase.recipient}</p><p className="mt-1 text-xs font-bold text-[#cbd5e1]">{formatCurrency(purchase.totalValue)} <span className="mx-1 font-normal text-[#64748b]">·</span> {paymentLabels[purchase.paymentMethod]}</p></div></div><div className="flex items-center gap-5 pl-[60px] sm:pl-0"><div className="min-w-[142px]"><p className="mono text-[10px] uppercase tracking-wider text-[#64748b]">{delivered ? "Entregue em" : "Previsão"}</p><p className="mt-1 text-xs font-bold text-[#cbd5e1]">{delivered ? formatDateTime(purchase.deliveredAt) : formatDate(purchase.deliveryDate)}</p></div><div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">{!delivered && <button onClick={onDelivered} disabled={busy} title="Marcar como entregue" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#34d399] hover:bg-[#10b981]/15"><Check size={15} /></button>}<button onClick={onEdit} title="Editar compra" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#6366f1]/15 hover:text-[#a5b4fc]"><Pencil size={15} /></button><button onClick={onDelete} title="Excluir compra" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#ef4444]/15 hover:text-[#fca5a5]"><Trash2 size={15} /></button></div></div></article>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "delivered" ? "bg-[#10b981]/15 text-[#34d399]" : status === "overdue" ? "bg-[#f59e0b]/15 text-[#fbbf24]" : "bg-[#6366f1]/15 text-[#a5b4fc]";
  return <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${tone}`}>{statusLabel[status] ?? status}</span>;
}

function AllPurchases({ onAdd }: { onAdd: () => void }) {
  const queryClient = useQueryClient();
  const purchasesQuery = useListPurchases();
  const del = useDeletePurchase();
  const update = useUpdatePurchase();
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "delivered">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "delivery">("newest");
  const purchases = purchasesQuery.data ?? [];
  const filtered = useMemo(() => purchases.filter((purchase) => {
    const haystack = `${purchase.productName} ${purchase.recipient} ${purchase.supplier}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (status === "all" || (status === "pending" ? purchase.status === "pending" || purchase.status === "overdue" : purchase.status === status));
  }).sort((a, b) => sort === "oldest" ? a.purchaseDate.localeCompare(b.purchaseDate) : sort === "delivery" ? (a.deliveryDate ?? "9999").localeCompare(b.deliveryDate ?? "9999") : b.purchaseDate.localeCompare(a.purchaseDate)), [purchases, search, status, sort]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const remove = (purchase: Purchase) => { if (window.confirm(`Excluir "${purchase.productName}"?`)) del.mutate({ id: purchase.id }, { onSuccess: invalidate }); };
  const markDelivered = (purchase: Purchase) => update.mutate({ id: purchase.id, data: { status: PurchaseStatus.delivered } }, { onSuccess: invalidate });
  return <div className="mx-auto max-w-[1440px]">
    <div className="animate-rise flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono text-[11px] uppercase tracking-[.2em] text-[#818cf8]">Acervo</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc] sm:text-[42px]">Todas as compras<span className="text-[#818cf8]">.</span></h1><p className="mt-2 text-sm text-[#94a3b8]">Busque, filtre e mantenha seus pedidos organizados.</p></div><button onClick={onAdd} className="focus-ring flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#6366f1] px-4 text-sm font-bold text-[#f8fafc] transition hover:bg-[#818cf8]"><Plus size={17} /> Nova compra</button></div>
     <section className="mt-9 overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] shadow-[0_18px_40px_rgba(2,6,23,.2)]">
       <div className="border-b border-[#334155] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3.5 text-[#64748b]" /><input data-testid="input-search-purchases" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por item, fornecedor ou solicitante" className="focus-ring h-11 w-full rounded-xl border border-[#334155] bg-[#0f172a] pl-10 pr-3 text-sm text-[#f8fafc] outline-none placeholder:text-[#64748b]" /></label><label className="relative"><select data-testid="select-purchase-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="focus-ring h-11 w-full appearance-none rounded-xl border border-[#334155] bg-[#0f172a] px-3 pr-9 text-xs font-bold text-[#cbd5e1] outline-none sm:w-36"><option value="all">Todos</option><option value="pending">A caminho</option><option value="delivered">Entregue</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-[#64748b]" /></label><label className="relative"><select data-testid="select-purchase-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="focus-ring h-11 w-full appearance-none rounded-xl border border-[#334155] bg-[#0f172a] px-3 pr-9 text-xs font-bold text-[#cbd5e1] outline-none sm:w-[142px]"><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="delivery">Por entrega</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-[#64748b]" /></label></div><p className="mt-4 text-xs text-[#64748b]"><strong className="text-[#cbd5e1]">{filtered.length}</strong> {filtered.length === 1 ? "compra encontrada" : "compras encontradas"}</p></div>
       {purchasesQuery.isLoading ? <TableSkeleton /> : purchasesQuery.isError ? <ErrorState onRetry={() => purchasesQuery.refetch()} /> : filtered.length === 0 ? <EmptyFilter hasAny={purchases.length > 0} onClear={() => { setSearch(""); setStatus("all"); }} onAdd={onAdd} /> : <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead className="border-b border-[#334155] bg-[#182337]"><tr className="text-[10px] uppercase tracking-[.12em] text-[#64748b]"><th className="px-6 py-4 font-bold">Compra</th><th className="px-4 py-4 font-bold">Solicitante</th><th className="px-4 py-4 font-bold">Total</th><th className="px-4 py-4 font-bold">Pagamento</th><th className="px-4 py-4 font-bold">Quantidade</th><th className="px-4 py-4 font-bold">Previsão / entrega</th><th className="px-4 py-4 font-bold">Status</th><th className="px-6 py-4 text-right font-bold">Ações</th></tr></thead><tbody className="divide-y divide-[#334155]">{filtered.map((purchase) => <PurchaseTableRow key={purchase.id} purchase={purchase} onEdit={() => setEditing(purchase)} onDelete={() => remove(purchase)} onDelivered={() => markDelivered(purchase)} busy={del.isPending || update.isPending} />)}</tbody></table></div>}
    </section>
    {editing && <EditModal purchase={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
  </div>;
}

function PurchaseTableRow({ purchase, onEdit, onDelete, onDelivered, busy }: { purchase: Purchase; onEdit: () => void; onDelete: () => void; onDelivered: () => void; busy: boolean }) {
  const delivered = purchase.status === "delivered";
  return <tr data-testid={`row-purchase-${purchase.id}`} className="group transition hover:bg-[#243249]"><td className="px-6 py-4"><div className="flex max-w-[280px] items-center gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${delivered ? "bg-[#10b981]/15 text-[#34d399]" : "bg-[#6366f1]/15 text-[#a5b4fc]"}`}><Package size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-[#f8fafc]">{purchase.productName}</p><p className="mt-1 truncate text-[11px] text-[#64748b]">{purchase.supplier} · {formatDate(purchase.purchaseDate)}</p></div></div></td><td className="px-4 py-4 text-sm text-[#cbd5e1]">{purchase.recipient}</td><td className="px-4 py-4 text-sm font-bold text-[#cbd5e1]">{formatCurrency(purchase.totalValue)}</td><td className="px-4 py-4 text-xs text-[#cbd5e1]">{paymentLabels[purchase.paymentMethod]}</td><td className="px-4 py-4 text-sm font-bold text-[#cbd5e1]">{purchase.quantity}</td><td className="px-4 py-4 text-xs font-semibold text-[#cbd5e1]">{delivered ? formatDateTime(purchase.deliveredAt) : formatDate(purchase.deliveryDate)}</td><td className="px-4 py-4"><StatusBadge status={purchase.status} /></td><td className="px-6 py-4"><div className="flex justify-end gap-1">{!delivered && <button onClick={onDelivered} disabled={busy} title="Marcar como entregue" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#34d399] hover:bg-[#10b981]/15"><Check size={15} /></button>}<button onClick={onEdit} title="Editar compra" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#6366f1]/15 hover:text-[#a5b4fc]"><Pencil size={15} /></button><button onClick={onDelete} title="Excluir compra" className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#ef4444]/15 hover:text-[#fca5a5]"><Trash2 size={15} /></button></div></td></tr>;
}

function AttachmentsPage() {
  const queryClient = useQueryClient();
  const attachmentsQuery = useListAttachments();
  const purchasesQuery = useListPurchases();
  const create = useCreateAttachment();
  const del = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [quotationName, setQuotationName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const purchases = purchasesQuery.data ?? [];
  const attachments = (attachmentsQuery.data ?? []).filter((item) => `${item.fileName} ${item.purchaseName} ${item.quotationName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const activePurchase = purchaseId === "standalone" ? "" : purchaseId || (purchases[0] ? String(purchases[0].id) : "");
  const upload = (file: File) => {
    if (!activePurchase && !quotationName.trim()) { setMessage("Informe o nome da cotação avulsa antes de enviar o arquivo."); return; }
    if (file.size > 8 * 1024 * 1024) { setMessage("O arquivo precisa ter no máximo 8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const data = result.includes(",") ? result.split(",")[1] : result;
      setMessage("Salvando anexo…");
       create.mutate({ data: { purchaseId: activePurchase ? Number(activePurchase) : null, quotationName: activePurchase ? null : quotationName.trim(), fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size, data } }, {
         onSuccess: () => { setMessage("Anexo salvo."); setQuotationName(""); queryClient.invalidateQueries({ queryKey: getListAttachmentsQueryKey() }); },
        onError: () => setMessage("Não foi possível salvar este anexo."),
      });
    };
    reader.readAsDataURL(file);
  };
  const remove = (item: Attachment) => {
    if (!window.confirm(`Excluir o anexo "${item.fileName}"?`)) return;
    del.mutate({ id: item.id }, { onSuccess: () => { setSelected((ids) => ids.filter((id) => id !== item.id)); queryClient.invalidateQueries({ queryKey: getListAttachmentsQueryKey() }); } });
  };
  const toggle = (id: number) => setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  return <div className="mx-auto max-w-[1440px] animate-rise">
     <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono text-[11px] uppercase tracking-[.2em] text-[#818cf8]">Biblioteca</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc] sm:text-[42px]">Anexos<span className="text-[#818cf8]">.</span></h1><p className="mt-2 text-sm text-[#94a3b8]">Notas fiscais, comprovantes e cotações em um só lugar.</p></div><div className="flex flex-col items-stretch gap-2 self-start sm:flex-row sm:items-center"><label className="relative"><span className="sr-only">Vínculo do anexo</span><select data-testid="select-attachment-link" value={purchaseId || (purchases[0] ? String(purchases[0].id) : "standalone")} onChange={(e) => setPurchaseId(e.target.value)} className="focus-ring h-11 w-full max-w-[240px] appearance-none rounded-xl border border-[#334155] bg-[#1e293b] px-3 pr-8 text-xs font-bold text-[#cbd5e1] outline-none"><option value="standalone">Cotação avulsa · sem compra</option>{purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.productName}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-3.5 text-[#64748b]" /></label>{!activePurchase && <input data-testid="input-quotation-name" value={quotationName} onChange={(e) => setQuotationName(e.target.value)} placeholder="Nome da cotação" aria-label="Nome da cotação avulsa" className="focus-ring h-11 w-full max-w-[210px] rounded-xl border border-[#334155] bg-[#0f172a] px-3 text-xs text-[#f8fafc] outline-none placeholder:text-[#64748b]" />}<input ref={inputRef} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} /><button data-testid="button-upload-attachment" onClick={() => inputRef.current?.click()} disabled={create.isPending} className="focus-ring flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 text-sm font-bold text-[#f8fafc] shadow-[0_8px_18px_rgba(99,102,241,.2)] transition hover:bg-[#818cf8] disabled:opacity-50"><Upload size={17} /> Upload anexo</button></div></div>
    <section className="mt-9 overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] shadow-[0_18px_40px_rgba(2,6,23,.2)]">
       <div className="flex flex-col gap-4 border-b border-[#334155] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-lg font-extrabold text-[#f8fafc]">Todos os anexos ({attachments.length})</h2><p className="mt-1 text-xs text-[#94a3b8]">Escolha uma compra ou informe o nome da cotação avulsa. Arquivos de até 8 MB.</p></div><label className="relative w-full sm:max-w-[280px]"><Search size={16} className="absolute left-3 top-3.5 text-[#64748b]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar anexos ou cotações" className="focus-ring h-11 w-full rounded-xl border border-[#334155] bg-[#0f172a] pl-10 pr-3 text-sm text-[#f8fafc] outline-none placeholder:text-[#64748b]" /></label></div>
       {message && <p data-testid="status-attachment" className={`border-b border-[#334155] px-6 py-3 text-xs ${message.includes("não") || message.includes("Não") || message.includes("Informe") ? "text-[#fca5a5]" : "text-[#94a3b8]"}`}>{message}</p>}
      {attachmentsQuery.isLoading ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-64 rounded-xl" />)}</div> : attachmentsQuery.isError ? <ErrorState onRetry={() => attachmentsQuery.refetch()} /> : attachments.length === 0 ? <EmptyAttachments hasAny={(attachmentsQuery.data ?? []).length > 0} onUpload={() => inputRef.current?.click()} /> : <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{attachments.map((item) => <AttachmentCard key={item.id} item={item} selected={selected.includes(item.id)} onToggle={() => toggle(item.id)} onDelete={() => remove(item)} />)}</div>}
    </section>
  </div>;
}

function AttachmentCard({ item, selected, onToggle, onDelete }: { item: Attachment; selected: boolean; onToggle: () => void; onDelete: () => void }) {
  const image = item.mimeType.startsWith("image/");
  const pdf = item.mimeType === "application/pdf";
  return <article data-testid={`card-attachment-${item.id}`} className={`group overflow-hidden rounded-xl border bg-[#182337] transition hover:border-[#6366f1]/70 ${selected ? "border-[#818cf8] ring-2 ring-[#6366f1]/20" : "border-[#334155]"}`}><div className="relative flex h-[170px] items-center justify-center overflow-hidden bg-[#0f172a]">{image ? <img src={item.downloadUrl} alt={item.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className={`grid h-16 w-16 place-items-center rounded-2xl ${pdf ? "bg-[#ef4444]/15 text-[#fca5a5]" : "bg-[#6366f1]/15 text-[#a5b4fc]"}`}>{pdf ? <FileText size={31} /> : <File size={31} />}</div>}<label className="absolute left-3 top-3 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-[#0f172a]/75 backdrop-blur"><input data-testid={`checkbox-attachment-${item.id}`} type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 accent-[#6366f1]" /><span className="sr-only">Selecionar {item.fileName}</span></label></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#f8fafc]" title={item.fileName}>{item.fileName}</h3><p className="mt-1 truncate text-xs text-[#94a3b8]">{item.purchaseId ? item.purchaseName : item.quotationName || "Cotação avulsa"}</p></div><button data-testid={`button-delete-attachment-${item.id}`} onClick={onDelete} title="Excluir anexo" className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#64748b] opacity-100 transition hover:bg-[#ef4444]/15 hover:text-[#fca5a5] sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={15} /></button></div><div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#64748b]"><span>{formatBytes(item.fileSize)}</span><span>{formatDate(item.createdAt)}</span></div><AttachmentDownloadButton item={item} /></div></article>;
}

function AttachmentDownloadButton({ item }: { item: Attachment }) {
  const download = useDownloadAttachment(item.id, { query: { enabled: false, queryKey: getDownloadAttachmentQueryKey(item.id) } });
  const handleDownload = async () => {
    const result = await download.refetch();
    if (!result.data) return;
    const url = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <button data-testid={`button-download-attachment-${item.id}`} onClick={handleDownload} disabled={download.isFetching} className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#334155] py-2 text-xs font-bold text-[#cbd5e1] transition hover:border-[#6366f1] hover:text-[#f8fafc] disabled:opacity-60"><Download size={14} /> {download.isFetching ? "Baixando…" : "Baixar arquivo"}</button>;
}

function EmptyAttachments({ hasAny, onUpload }: { hasAny: boolean; onUpload: () => void }) {
  return <div className="flex flex-col items-center px-6 py-16 text-center"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#6366f1]/15 text-[#a5b4fc]"><Paperclip size={28} /></div><h3 className="mt-5 font-extrabold text-[#f8fafc]">{hasAny ? "Nenhum anexo corresponde à busca" : "Sua biblioteca está pronta"}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#94a3b8]">{hasAny ? "Tente buscar pelo nome do arquivo ou da compra." : "Adicione comprovantes e documentos para encontrá-los rapidamente depois."}</p>{!hasAny && <button onClick={onUpload} className="focus-ring mt-6 flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-bold text-[#f8fafc]"><Upload size={16} /> Enviar primeiro anexo</button>}</div>;
}

function PurchaseEntry({ onDone, existing }: { onDone: () => void; existing?: Purchase }) {
  const queryClient = useQueryClient();
  const create = useCreatePurchase();
  const update = useUpdatePurchase();
  const [form, setForm] = useState<FormState>(() => existing ? { purchaseDate: dateInput(existing.purchaseDate), deliveryDate: dateInput(existing.deliveryDate), supplier: existing.supplier, productName: existing.productName, recipient: existing.recipient, base: existing.base, quantity: String(existing.quantity), totalValue: String(existing.totalValue), paymentMethod: existing.paymentMethod, status: existing.status } : initialForm);
  const [error, setError] = useState("");
  const setField = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.purchaseDate || !form.supplier || !form.productName || !form.recipient || !form.base || form.totalValue === "" || Number(form.quantity) < 1 || Number(form.totalValue) < 0) { setError("Preencha os campos obrigatórios para salvar a compra."); return; }
    const data: PurchaseInput = { purchaseDate: form.purchaseDate, deliveryDate: form.deliveryDate || null, supplier: form.supplier.trim(), productName: form.productName.trim(), recipient: form.recipient.trim(), base: form.base.trim(), quantity: Number(form.quantity), totalValue: Number(form.totalValue), paymentMethod: form.paymentMethod, source: PurchaseInputSource.manual, ...(!existing ? { status: form.status } : {}) };
    const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); onDone(); };
    if (existing) update.mutate({ id: existing.id, data }, { onSuccess, onError: () => setError("Não foi possível salvar. Tente novamente.") });
    else create.mutate({ data }, { onSuccess, onError: () => setError("Não foi possível salvar. Tente novamente.") });
  };
  const busy = create.isPending || update.isPending;
  return <div className="mx-auto max-w-[980px] animate-rise"><button onClick={onDone} className="focus-ring mb-7 flex items-center gap-2 text-xs font-bold text-[#94a3b8] hover:text-[#f8fafc]"><ArrowLeft size={15} /> Voltar</button><div className="mb-9"><p className="mono text-[11px] uppercase tracking-[.2em] text-[#818cf8]">{existing ? "Edição" : "Nova entrada"}</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc] sm:text-[42px]">{existing ? "Editar compra" : "Adicionar compra"}<span className="text-[#818cf8]">.</span></h1><p className="mt-2 text-sm text-[#94a3b8]">Registre os detalhes que você vai querer encontrar depois.</p></div><form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_290px]"><div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5 shadow-[0_18px_40px_rgba(2,6,23,.2)] sm:p-7"><div className="mb-7 flex items-center gap-3 border-b border-[#334155] pb-5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#6366f1]/15 text-[#a5b4fc]"><ClipboardList size={17} /></span><div><h2 className="text-sm font-extrabold text-[#f8fafc]">Detalhes do pedido</h2><p className="text-xs text-[#94a3b8]">Campos editáveis para sua revisão.</p></div></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Nome do item" required value={form.productName} onChange={(v) => setField("productName", v)} placeholder="Ex.: Fone Bluetooth" testId="input-product-name" /><Field label="Fornecedor" required value={form.supplier} onChange={(v) => setField("supplier", v)} placeholder="Ex.: Loja da esquina" testId="input-supplier" /><Field label="Data da compra/postagem" required type="date" value={form.purchaseDate} onChange={(v) => setField("purchaseDate", v)} testId="input-purchase-date" /><Field label="Previsão de entrega" type="date" value={form.deliveryDate} onChange={(v) => setField("deliveryDate", v)} testId="input-delivery-date" /><Field label="Solicitante" required value={form.recipient} onChange={(v) => setField("recipient", v)} placeholder="Ex.: Duda" testId="input-recipient" /><Field label="Base de organização" required value={form.base} onChange={(v) => setField("base", v)} placeholder="Ex.: Casa, trabalho…" testId="input-base" /><Field label="Quantidade" required type="number" value={form.quantity} onChange={(v) => setField("quantity", v)} placeholder="1" testId="input-quantity" /><Field label="Valor total da compra" required type="number" value={form.totalValue} onChange={(v) => setField("totalValue", v)} placeholder="0,00" testId="input-total-value" /><label className="block"><span className="mb-2 block text-xs font-extrabold text-[#cbd5e1]">Forma de pagamento <b className="text-[#818cf8]">*</b></span><select data-testid="select-payment-method" value={form.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value as PurchaseInputPaymentMethod)} className="focus-ring h-11 w-full appearance-none rounded-xl border border-[#334155] bg-[#0f172a] px-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#6366f1]"><option value={PurchaseInputPaymentMethod.not_informed}>Não informada</option><option value={PurchaseInputPaymentMethod.pix}>Pix</option><option value={PurchaseInputPaymentMethod.credit_card}>Cartão de crédito</option><option value={PurchaseInputPaymentMethod.debit_card}>Cartão de débito</option><option value={PurchaseInputPaymentMethod.boleto}>Boleto</option><option value={PurchaseInputPaymentMethod.cash}>Dinheiro</option><option value={PurchaseInputPaymentMethod.other}>Outra</option></select></label></div>{error && <InlineError testId="status-form-error">{error}</InlineError>}<div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#334155] pt-6 sm:flex-row sm:justify-end"><button type="button" onClick={onDone} className="focus-ring h-11 rounded-xl px-5 text-sm font-bold text-[#94a3b8] hover:bg-[#243249]">Cancelar</button><button disabled={busy} className="focus-ring flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-6 text-sm font-bold text-[#f8fafc] shadow-[0_8px_18px_rgba(99,102,241,.2)] hover:bg-[#818cf8] disabled:opacity-60">{busy && "Salvando…"} {!busy && (existing ? "Salvar alterações" : "Salvar compra")}</button></div></div><aside className="h-fit rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/10 p-5"><div className="flex items-center gap-2 text-[#a5b4fc]"><ShieldCheck size={17} /><span className="text-xs font-extrabold">Organização simples</span></div><p className="mt-3 text-sm leading-6 text-[#c7d2fe]">Depois de salvar, use a aba <strong>Anexos</strong> para adicionar notas fiscais, comprovantes e outros documentos.</p></aside></form></div>;
}

function EditModal({ purchase, onClose, onSaved }: { purchase: Purchase; onClose: () => void; onSaved: () => void }) {
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#020617]/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-[1040px] overflow-y-auto rounded-t-3xl border border-[#334155] bg-[#0f172a] p-5 shadow-2xl sm:rounded-3xl sm:p-8"><div className="mb-1 flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#818cf8]">Edição rápida</p><h2 className="mt-1 text-xl font-extrabold text-[#f8fafc]">Ajustar compra</h2></div><button onClick={onClose} aria-label="Fechar edição" className="focus-ring grid h-9 w-9 place-items-center rounded-xl text-[#94a3b8] hover:bg-[#1e293b]"><X size={18} /></button></div><div className="mt-5"><PurchaseEntry existing={purchase} onDone={onSaved} /></div></div></div>;
}

function ExportHistory() {
  const queryClient = useQueryClient();
  const history = useListExportHistory();
  const createExport = useCreateExportRecord();
  const purchases = useListPurchases();
  const [format, setFormat] = useState<keyof typeof ExportInputFormat>("csv");
  const download = () => {
    const rows = purchases.data ?? [];
     const exportRows = rows.map((purchase) => ({ Item: purchase.productName, Fornecedor: purchase.supplier, "Data da compra": purchase.purchaseDate, "Previsão de entrega": purchase.deliveryDate ?? "", "Entregue em": purchase.deliveredAt ?? "", Solicitante: purchase.recipient, Base: purchase.base, Quantidade: purchase.quantity, "Valor total": purchase.totalValue, "Forma de pagamento": paymentLabels[purchase.paymentMethod], Status: statusLabel[purchase.status] }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compras");
    const output = XLSX.write(workbook, { bookType: format, type: format === "csv" ? "string" : "array" });
    const blob = new Blob([output], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `organiza-compras.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    createExport.mutate({ data: { format: ExportInputFormat[format], rowCount: rows.length } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExportHistoryQueryKey() }) });
  };
  return <div className="mx-auto max-w-[1100px] animate-rise"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono text-[11px] uppercase tracking-[.2em] text-[#818cf8]">Arquivo</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.06em] text-[#f8fafc] sm:text-[42px]">Exportações<span className="text-[#818cf8]">.</span></h1><p className="mt-2 text-sm text-[#94a3b8]">Arquivos reais para levar suas compras com você.</p></div><div className="flex gap-2"><select value={format} onChange={(e) => setFormat(e.target.value as keyof typeof ExportInputFormat)} className="focus-ring h-11 rounded-xl border border-[#334155] bg-[#1e293b] px-3 text-xs font-bold text-[#cbd5e1] outline-none"><option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="ods">ODS</option></select><button onClick={download} disabled={createExport.isPending || purchases.isLoading} className="focus-ring flex h-11 items-center gap-2 rounded-xl bg-[#6366f1] px-4 text-xs font-bold text-[#f8fafc] shadow-[0_8px_18px_rgba(99,102,241,.2)] hover:bg-[#818cf8] disabled:opacity-60"><Download size={16} /> Exportar planilha</button></div></div><section className="mt-9 overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] shadow-[0_18px_40px_rgba(2,6,23,.2)]"><div className="border-b border-[#334155] px-6 py-5"><h2 className="text-lg font-extrabold text-[#f8fafc]">Documentos gerados</h2><p className="mt-1 text-xs text-[#94a3b8]">Cada exportação guarda o retrato das compras naquele momento.</p></div>{history.isLoading ? <div className="space-y-3 p-6">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> : history.isError ? <ErrorState onRetry={() => history.refetch()} /> : (history.data ?? []).length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center"><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#6366f1]/15 text-[#a5b4fc]"><FileSpreadsheet size={25} /></div><h3 className="mt-4 font-extrabold text-[#f8fafc]">Nenhum arquivo ainda</h3><p className="mt-2 max-w-xs text-sm text-[#94a3b8]">Quando você exportar suas compras, o registro aparece aqui.</p></div> : <div className="divide-y divide-[#334155]">{(history.data ?? []).map((record) => <div key={record.id} className="flex items-center gap-4 px-6 py-5"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#6366f1]/15 text-[#a5b4fc]"><FileSpreadsheet size={18} /></div><div className="min-w-0 flex-1"><p className="text-sm font-extrabold uppercase text-[#f8fafc]">{record.format} <span className="ml-2 text-xs font-medium normal-case text-[#94a3b8]">· {record.rowCount} linhas</span></p><p className="mt-1 text-xs text-[#94a3b8]">Exportado em {formatDateTime(record.createdAt)}</p></div><Download size={16} className="text-[#64748b]" /></div>)}</div>}</section></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function PurchaseSkeleton() { return <div className="divide-y divide-[#334155]">{[1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 px-7 py-5"><div className="skeleton h-11 w-11 rounded-xl" /><div className="flex-1"><div className="skeleton h-4 w-44 rounded" /><div className="skeleton mt-2 h-3 w-28 rounded" /></div><div className="skeleton h-8 w-20 rounded" /></div>)}</div>; }
function TableSkeleton() { return <div className="space-y-3 p-6">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-14 rounded-lg" />)}</div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="flex flex-col items-center px-6 py-14 text-center"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#ef4444]/15 text-[#fca5a5]"><AlertCircle size={21} /></div><p className="mt-4 font-bold text-[#f8fafc]">Não conseguimos carregar os dados.</p><button onClick={onRetry} className="focus-ring mt-3 flex items-center gap-2 text-xs font-bold text-[#a5b4fc]">Tentar de novo</button></div>; }
function EmptyPurchases({ onAdd }: { onAdd: () => void }) { return <div className="flex flex-col items-center px-6 py-16 text-center"><div className="grid h-16 w-16 place-items-center rounded-xl bg-[#6366f1]/15 text-[#a5b4fc]"><Package size={27} /></div><h3 className="mt-5 font-extrabold text-[#f8fafc]">Seu espaço está pronto</h3><p className="mt-2 max-w-xs text-sm leading-relaxed text-[#94a3b8]">Adicione sua primeira compra para começar a acompanhar tudo com clareza.</p><button onClick={onAdd} className="focus-ring mt-6 flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-bold text-[#f8fafc]"><Plus size={16} /> Adicionar primeira compra</button></div>; }
function EmptyFilter({ hasAny, onClear, onAdd }: { hasAny: boolean; onClear: () => void; onAdd: () => void }) { return <div className="flex flex-col items-center px-6 py-16 text-center"><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#334155] text-[#94a3b8]"><Search size={24} /></div><h3 className="mt-4 font-extrabold text-[#f8fafc]">{hasAny ? "Nenhuma compra corresponde aos filtros" : "Nenhuma compra cadastrada"}</h3><p className="mt-2 max-w-xs text-sm text-[#94a3b8]">{hasAny ? "Ajuste sua busca ou status para encontrar um pedido." : "Comece adicionando seu primeiro pedido."}</p><button onClick={hasAny ? onClear : onAdd} className="focus-ring mt-5 rounded-xl border border-[#334155] px-4 py-2.5 text-xs font-bold text-[#cbd5e1]">{hasAny ? "Limpar filtros" : "Adicionar compra"}</button></div>; }
function InlineError({ children, testId }: { children: ReactNode; testId: string }) { return <div data-testid={testId} className="mt-5 flex items-start gap-2 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#fca5a5]"><AlertCircle size={17} className="mt-0.5 shrink-0" />{children}</div>; }
function Field({ label, value, onChange, placeholder, type = "text", required = false, testId, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; testId: string; autoComplete?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-extrabold text-[#cbd5e1]">{label} {required && <b className="text-[#818cf8]">*</b>}</span><input data-testid={testId} required={required} min={type === "number" ? 1 : undefined} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="focus-ring h-11 w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 text-sm text-[#f8fafc] outline-none transition placeholder:text-[#64748b] focus:border-[#6366f1]" /></label>;
}

export default App;