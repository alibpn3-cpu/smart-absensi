import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BellOff, BellRing, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Notif {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staffUid: string;
}

export default function NotificationsDialog({ open, onOpenChange, staffUid }: Props) {
  const [items, setItems] = useState<Notif[]>([]);
  const push = usePushNotifications(staffUid);
  const navigate = useNavigate();

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  useEffect(() => {
    if (!open || !staffUid) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, type, link, read_at, created_at")
        .eq("staff_uid", staffUid)
        .order("created_at", { ascending: false })
        .limit(50);
      if (mounted && data) setItems(data as any);
    })();

    const channel = supabase
      .channel(`notif-dlg:${staffUid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `staff_uid=eq.${staffUid}` },
        (payload) => setItems((prev) => [payload.new as any, ...prev].slice(0, 50)),
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [open, staffUid]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  };

  const handleClick = async (n: Notif) => {
    if (!n.read_at) await markRead(n.id);
    onOpenChange(false);
    if (n.link) navigate(n.link);
  };

  const handleSubscribe = async () => {
    const ok = await push.subscribe();
    if (ok) toast.success("Notifikasi push diaktifkan");
    else if (push.permission === "denied") toast.error("Izin notifikasi diblokir di browser");
    else toast.error("Gagal mengaktifkan notifikasi");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <DialogTitle className="text-base">Notifikasi {unreadCount > 0 && <span className="text-xs text-muted-foreground font-normal">({unreadCount} belum dibaca)</span>}</DialogTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Tandai dibaca
            </Button>
          )}
        </DialogHeader>
        <Separator />

        {push.supported && !push.subscribed && (
          <div className="p-3 bg-muted/40 text-xs flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" /> Aktifkan push notifikasi
            </span>
            <Button size="sm" className="h-7 text-xs" onClick={handleSubscribe} disabled={push.loading}>Aktifkan</Button>
          </div>
        )}
        {push.supported && push.subscribed && (
          <div className="p-2 bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1"><BellRing className="h-3 w-3" /> Push aktif</span>
            <button className="underline hover:text-foreground flex items-center gap-1" onClick={() => push.unsubscribe()}>
              <BellOff className="h-3 w-3" /> Matikan
            </button>
          </div>
        )}

        <ScrollArea className="h-96">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Belum ada notifikasi</div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{n.title}</div>
                    {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
