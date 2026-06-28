import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  link_url: string | null;
  work_area: string;
}

interface Props {
  workArea?: string | null;
}

export default function AnnouncementsCarousel({ workArea }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!workArea) return;
    let mounted = true;
    const load = async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, image_url, link_url, work_area, starts_at, ends_at, is_active")
        .eq("work_area", workArea)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const filtered = (data || []).filter((a: any) => {
        if (a.starts_at && a.starts_at > nowIso) return false;
        if (a.ends_at && a.ends_at < nowIso) return false;
        return true;
      });
      if (mounted) setItems(filtered as any);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, [workArea]);

  // Auto-slide every 6s
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const a = items[idx % items.length];

  return (
    <Card className="border-0 shadow-md rounded-xl bg-gradient-to-br from-primary/5 via-card to-amber-50 dark:to-amber-950/20 overflow-hidden">
      <CardContent className="p-0">
        <div className="relative">
          {a.image_url && (
            <div className="w-full h-32 bg-muted overflow-hidden">
              <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-start gap-2">
              <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{a.body}</div>
                {a.link_url && (
                  <a href={a.link_url} target="_blank" rel="noreferrer"
                     className="text-xs text-primary underline mt-2 inline-block">
                    Selengkapnya →
                  </a>
                )}
              </div>
            </div>

            {items.length > 1 && (
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  {items.map((_, i) => (
                    <span key={i}
                      className={`h-1.5 rounded-full transition-all ${i === idx ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5"}`} />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => setIdx((i) => (i + 1) % items.length)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
