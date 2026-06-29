import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  workArea: string;
  createdByUid: string;
  createdByName: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  work_area: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const emptyForm = {
  title: "", body: "", image_url: "", link_url: "",
  is_active: true, starts_at: "", ends_at: "",
};

const BIRTHDAY_KEY = "birthday_disabled_areas";

export default function AnnouncementManager({ workArea, createdByUid, createdByName }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("work_area", workArea)
      .order("created_at", { ascending: false });
    setItems((data || []) as any);

    // Load birthday-disabled flag for this area
    const { data: setting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", BIRTHDAY_KEY)
      .maybeSingle();
    try {
      const arr: string[] = setting?.setting_value ? JSON.parse(setting.setting_value) : [];
      setBirthdayEnabled(!arr.includes(workArea));
    } catch { setBirthdayEnabled(true); }

    setLoading(false);
  };

  useEffect(() => { load(); }, [workArea]);

  const toggleBirthday = async (enabled: boolean) => {
    setBirthdayEnabled(enabled);
    const { data: setting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", BIRTHDAY_KEY)
      .maybeSingle();
    let arr: string[] = [];
    try { arr = setting?.setting_value ? JSON.parse(setting.setting_value) : []; } catch {}
    const next = enabled
      ? arr.filter((a) => a !== workArea)
      : Array.from(new Set([...arr, workArea]));
    const payload = { setting_key: BIRTHDAY_KEY, setting_value: JSON.stringify(next) };
    if (setting) {
      await supabase.from("app_settings").update({ setting_value: payload.setting_value }).eq("setting_key", BIRTHDAY_KEY);
    } else {
      await supabase.from("app_settings").insert(payload);
    }
    toast.success(enabled ? "Birthday card diaktifkan" : "Birthday card disembunyikan");
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      title: a.title, body: a.body,
      image_url: a.image_url || "", link_url: a.link_url || "",
      is_active: a.is_active,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : "",
      ends_at: a.ends_at ? a.ends_at.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Judul dan isi wajib diisi");
      return;
    }
    // Normalize link URL — prepend https:// if missing scheme
    let normalizedLink: string | null = form.link_url.trim() || null;
    if (normalizedLink && !/^https?:\/\//i.test(normalizedLink)) {
      normalizedLink = `https://${normalizedLink}`;
    }
    const payload: any = {
      title: form.title.trim(),
      body: form.body.trim(),
      work_area: workArea,
      image_url: form.image_url.trim() || null,
      link_url: normalizedLink,
      is_active: form.is_active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      created_by_uid: createdByUid,
      created_by_name: createdByName,
    };
    const { error } = editId
      ? await supabase.from("announcements").update(payload).eq("id", editId)
      : await supabase.from("announcements").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Pengumuman diperbarui" : "Pengumuman dibuat");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus pengumuman ini?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dihapus");
    load();
  };

  const toggleActive = async (a: Announcement) => {
    await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Pengumuman ({workArea})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Hanya user di area kerja <strong>{workArea}</strong> yang akan melihat pengumuman ini.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Buat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Pengumuman" : "Pengumuman Baru"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Judul *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Isi *</Label>
                <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <div>
                <Label>URL Gambar (opsional)</Label>
                <Input placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              </div>
              <div>
                <Label>URL Link (opsional)</Label>
                <Input placeholder="https://..." value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mulai (opsional)</Label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>Berakhir (opsional)</Label>
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/40 rounded">
                <Label className="cursor-pointer">Aktif</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={save}>{editId ? "Simpan" : "Buat"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Memuat...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Belum ada pengumuman</div>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.title}</span>
                    <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">
                      {a.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {a.starts_at ? `Mulai ${new Date(a.starts_at).toLocaleString("id-ID")}` : ""}
                    {a.ends_at ? ` · Berakhir ${new Date(a.ends_at).toLocaleString("id-ID")}` : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Pengaturan Area: toggle birthday card */}
      <CardContent className="border-t pt-4">
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
          <div className="min-w-0">
            <div className="text-sm font-medium">Tampilkan Birthday Card</div>
            <div className="text-xs text-muted-foreground">
              Jika dimatikan, user di area <strong>{workArea}</strong> tidak akan melihat card ulang tahun di halaman utama.
            </div>
          </div>
          <Switch checked={birthdayEnabled} onCheckedChange={toggleBirthday} />
        </div>
      </CardContent>
    </Card>
  );
}
