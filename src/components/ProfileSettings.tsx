import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (displayName: string, avatarUrl: string) => void;
}

/** Resize any image file to a 256×256 center-cropped JPEG and return a base64 data-URL.
 *  This runs entirely in-browser — no storage bucket required. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image decode failed"));
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileSettings({ open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const latestAvatarRef = useRef(""); // always-current, avoids stale closure in handleSave

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]     = useState("");
  const [preview, setPreview]       = useState("");
  const [urlDraft, setUrlDraft]     = useState(""); // text in the URL input box
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving]         = useState(false);

  // Helper: update both the ref and every piece of avatar display state at once
  const applyAvatar = (url: string) => {
    latestAvatarRef.current = url;
    setPreview(url);
    if (!url.startsWith("data:")) setUrlDraft(url); // don't show base64 in the text box
    else setUrlDraft("");
  };

  // Load profile when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setDisplayName(
          data?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name || ""
        );
        applyAvatar(
          data?.avatar_url ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture || ""
        );
      });
    supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [open, user?.id]);

  // File picked — resize client-side and show immediately, no upload needed
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be picked again
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setProcessing(true);
    try {
      const dataUrl = await resizeImage(file);
      applyAvatar(dataUrl);
    } catch {
      toast.error("Could not process image — try a different file.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const finalUrl = latestAvatarRef.current;
    const { error } = await supabase.from("profiles").upsert(
      { user_id: user.id, email: user.email ?? null,
        display_name: displayName.trim() || null,
        avatar_url:   finalUrl || null },
      { onConflict: "user_id" }
    );
    if (error) { setSaving(false); toast.error(error.message); return; }
    if (username.trim()) {
      await supabase.from("profiles")
        .update({ username: username.trim() })
        .eq("user_id", user.id);
    }
    setSaving(false);
    toast.success("Profile saved");
    onSaved(
      displayName.trim() || user.user_metadata?.full_name || user.email || "User",
      finalUrl
    );
    onClose();
  };

  const initials = (displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4" />Edit Profile
          </DialogTitle>
        </DialogHeader>

        {/* Avatar preview + pick button */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            {preview
              ? <img src={preview} alt="avatar"
                     className="w-20 h-20 rounded-full object-cover border-2 border-border shadow-md"
                     onError={() => applyAvatar("")}
                />
              : <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600
                               flex items-center justify-center text-2xl font-bold text-white
                               border-2 border-border shadow-md">{initials}</div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={processing}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-500 hover:bg-violet-600
                         border-2 border-card flex items-center justify-center shadow
                         transition-colors disabled:opacity-60">
              {processing
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Camera  className="w-3.5 h-3.5 text-white" />}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-xs text-muted-foreground">Click the camera to upload a photo</p>
        </div>

        {/* URL fallback */}
        <div className="space-y-1">
          <Label className="text-xs">Photo URL <span className="text-muted-foreground font-normal">(optional — paste a direct image link)</span></Label>
          <Input
            placeholder="https://…"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={() => { if (urlDraft.trim()) applyAvatar(urlDraft.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter" && urlDraft.trim()) applyAvatar(urlDraft.trim()); }}
            className="bg-secondary border-border h-9 text-xs"
          />
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Display Name</Label>
            <Input placeholder="Your full name" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-secondary border-border h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
              <Input placeholder="yourhandle" value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                className="bg-secondary border-border h-9 pl-7" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-secondary border-border h-9 opacity-60" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || processing}
            className="flex-1 bg-gradient-brand text-primary-foreground hover:opacity-90">
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Saving…</> : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
