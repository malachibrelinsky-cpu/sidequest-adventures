import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Heart, MessageCircle, Image as ImageIcon, X, Send } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed — SideQuest" }, { name: "description", content: "See photos from member adventures and share your own." }] }),
  component: FeedPage,
});

type Profile = { id: string; display_name: string; avatar_url: string | null };
type Comment = { id: string; body: string; created_at: string; user_id: string; profiles: Profile | null };
type Post = { id: string; caption: string | null; image_urls: string[]; created_at: string; user_id: string; profiles: Profile | null; comments: Comment[] };

const captionSchema = z.string().trim().max(500);
const commentSchema = z.string().trim().min(1).max(1000);

function FeedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, caption, image_urls, created_at, user_id, profiles!posts_user_id_fkey(id, display_name, avatar_url), comments(id, body, created_at, user_id, profiles!comments_user_id_fkey(id, display_name, avatar_url))")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); return; }
    setPosts((data as unknown as Post[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">The Feed</h1>
          <p className="text-muted-foreground">Photos and stories from quests around you.</p>
        </div>

        <ComposePost onPosted={load} />

        {fetching ? (
          <p className="text-muted-foreground text-center py-12">Loading posts…</p>
        ) : posts.length === 0 ? (
          <div className="bento-card p-10 text-center mt-6">
            <p className="text-muted-foreground">No posts yet. Be the first to share a side quest.</p>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {posts.map((p) => <PostCard key={p.id} post={p} onChange={load} currentUserId={user.id} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ComposePost({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, 4);
    setFiles(picked);
  };

  const submit = async () => {
    if (!user) return;
    if (files.length === 0) { toast.error("Add at least one photo"); return; }
    const cap = captionSchema.safeParse(caption);
    if (!cap.success) { toast.error("Caption too long"); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("post-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      const { error } = await supabase.from("posts").insert({ user_id: user.id, caption: caption.trim() || null, image_urls: urls });
      if (error) throw error;
      setCaption(""); setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Posted!");
      onPosted();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="bento-card p-5">
      <textarea
        value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500}
        placeholder="What was the side quest tonight?"
        className="w-full bg-transparent resize-none outline-none placeholder:text-muted-foreground"
        rows={2}
      />
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary cursor-pointer transition">
          <ImageIcon className="size-5" /> Add photos (up to 4)
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        </label>
        <button
          onClick={submit} disabled={uploading || files.length === 0}
          className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2 font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition"
        >
          {uploading ? "Posting…" : "Share"}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, onChange, currentUserId }: { post: Post; onChange: () => void; currentUserId: string }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const profile = post.profiles;

  const addComment = async () => {
    const parsed = commentSchema.safeParse(newComment);
    if (!parsed.success) { toast.error("Comment can't be empty"); return; }
    setPosting(true);
    const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: currentUserId, body: parsed.data });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    onChange();
  };

  return (
    <article className="bento-card overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <Avatar profile={profile} />
        <div>
          <p className="font-semibold text-sm">{profile?.display_name ?? "Quester"}</p>
          <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>
        </div>
      </div>
      {post.image_urls.length > 0 && (
        <div className={`grid gap-1 ${post.image_urls.length === 1 ? "" : post.image_urls.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {post.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" loading="lazy" className="w-full aspect-square object-cover" />
          ))}
        </div>
      )}
      {post.caption && <p className="px-4 pt-4 text-sm">{post.caption}</p>}
      <div className="px-4 py-3 flex items-center gap-4 text-sm text-muted-foreground">
        <button className="flex items-center gap-1.5 hover:text-primary transition">
          <Heart className="size-5" />
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 hover:text-primary transition">
          <MessageCircle className="size-5" /> {post.comments.length}
        </button>
      </div>
      {showComments && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {post.comments.length === 0 && <p className="text-xs text-muted-foreground">Be the first to comment.</p>}
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar profile={c.profiles} small />
              <div className="bg-muted/40 rounded-2xl px-3 py-2 text-sm flex-1">
                <p className="font-semibold text-xs">{c.profiles?.display_name ?? "Quester"}</p>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-center pt-2">
            <input
              value={newComment} onChange={(e) => setNewComment(e.target.value)} maxLength={1000}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              placeholder="Add a comment…"
              className="flex-1 rounded-full bg-input/40 border border-border px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button onClick={addComment} disabled={posting} className="rounded-full bg-primary text-primary-foreground p-2 disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Avatar({ profile, small }: { profile: Profile | null; small?: boolean }) {
  const size = small ? "size-7" : "size-10";
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${size} rounded-full object-cover`} />;
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold text-sm`}>
      {(profile?.display_name ?? "?")[0].toUpperCase()}
    </div>
  );
}
