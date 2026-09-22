'use client';

import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { motion } from '@/shared/utils/motion';
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Lock,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { Box } from '@mui/material';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';

type TPostType = 'discussion' | 'announcement' | 'poll';
type TScope = 'institution' | 'roles' | 'departments';
interface IAttachment {
  name: string;
  url: string;
  publicId?: string;
}
interface IPollOption {
  id: string;
  label: string;
  voteCount: number;
}
interface IPost {
  _id: string;
  type: TPostType;
  title: string;
  content: string;
  scope: TScope;
  attachments: IAttachment[];
  pollOptions: IPollOption[];
  pollEndsAt?: string;
  allowMultipleVotes: boolean;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  createdByName: string;
  createdBy: string | { _id?: string };
  myVoteOptionIds: string[];
  createdAt: string;
}
interface IReply {
  _id: string;
  content: string;
  attachments: IAttachment[];
  createdByName: string;
  createdAt: string;
}
interface IPostDetail {
  post: IPost;
  replies: IReply[];
}
interface IAlbum {
  _id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  mediaCount: number;
  createdAt: string;
  createdBy: string | { _id?: string };
}
interface IMedia {
  _id: string;
  title: string;
  description?: string;
  url: string;
  publicId?: string;
  mimeType: string;
}
interface IAlbumDetail {
  album: IAlbum;
  media: IMedia[];
}
interface IMetadata {
  roles: Array<{ name: string; displayName: string }>;
  departments: Array<{ _id: string; name: string; code: string }>;
  postTypes: TPostType[];
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const inputClass =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';

export default function CollaborationPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const publisher = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'hod',
    'faculty',
    'administration_office',
  ].includes(activeRole);
  const moderator = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
  ].includes(activeRole);
  const { data: metadataRaw, error: metadataError } =
    useSwr<IApiResponse<IMetadata>>('collaboration/metadata');
  const {
    data: postsRaw,
    error: postsError,
    mutate: refreshPosts,
  } = useSwr<IApiResponse<IPost[]>>('collaboration/posts');
  const {
    data: albumsRaw,
    error: albumsError,
    mutate: refreshAlbums,
  } = useSwr<IApiResponse<IAlbum[]>>('collaboration/albums');
  const { mutation, isLoading } = useMutation();
  const metadata = metadataRaw?.data;
  const posts = useMemo(() => postsRaw?.data ?? [], [postsRaw]);
  const albums = useMemo(() => albumsRaw?.data ?? [], [albumsRaw]);
  const [tab, setTab] = useState<'feed' | 'polls' | 'gallery'>('feed');
  const [search, setSearch] = useState('');
  const [composer, setComposer] = useState(false);
  const [albumComposer, setAlbumComposer] = useState(false);
  const [type, setType] = useState<TPostType>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<TScope>('institution');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollEndsAt, setPollEndsAt] = useState('');
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detailRaw, mutate: refreshDetail } = useSwr<IApiResponse<IPostDetail>>(
    detailId ? `collaboration/posts/${detailId}` : null,
  );
  const detail = detailRaw?.data;
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<IAttachment[]>([]);
  const [selectedVotes, setSelectedVotes] = useState<string[]>([]);
  const [albumName, setAlbumName] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumId, setAlbumId] = useState<string | null>(null);
  const { data: albumDetailRaw, mutate: refreshAlbumDetail } = useSwr<IApiResponse<IAlbumDetail>>(
    albumId ? `collaboration/albums/${albumId}` : null,
  );
  const albumDetail = albumDetailRaw?.data;
  const albumOwnerId =
    typeof albumDetail?.album.createdBy === 'string'
      ? albumDetail.album.createdBy
      : String(albumDetail?.album.createdBy?._id ?? '');
  const canAddAlbumMedia = moderator || (!!userId && albumOwnerId === userId);
  const detailOwnerId =
    typeof detail?.post.createdBy === 'string'
      ? detail.post.createdBy
      : String(detail?.post.createdBy?._id ?? '');
  const canManageDetail = moderator || (!!userId && detailOwnerId === userId);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<IViewerFile[]>([]);
  const resetPost = () => {
    setType('discussion');
    setTitle('');
    setContent('');
    setScope('institution');
    setTargetRoles([]);
    setTargetDepartments([]);
    setAttachments([]);
    setPollOptions(['', '']);
    setPollEndsAt('');
    setAllowMultipleVotes(false);
  };
  const uploadAttachment = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) return false;
    setAttachments((current) => [
      ...current,
      {
        url: uploaded.url as string,
        name: uploaded.filename ?? file.name,
        publicId: uploaded.publicId,
      },
    ]);
    return true;
  };
  const createPost = async () => {
    const response = await mutation('collaboration/posts', {
      method: 'POST',
      body: {
        type,
        title,
        content,
        scope,
        targetRoles,
        targetDepartments,
        attachments,
        pollOptions: type === 'poll' ? pollOptions : undefined,
        pollEndsAt: type === 'poll' && pollEndsAt ? pollEndsAt : undefined,
        allowMultipleVotes,
      },
    });
    if (!response?.results?.success) return;
    toast.success(type === 'poll' ? 'Poll published' : 'Post published');
    await refreshPosts();
    setComposer(false);
    resetPost();
  };
  const sendReply = async () => {
    if (!detailId || reply.trim().length < 1) return;
    const response = await mutation(`collaboration/posts/${detailId}/replies`, {
      method: 'POST',
      body: { content: reply, attachments: replyAttachments },
    });
    if (!response?.results?.success) return;
    toast.success('Reply posted');
    await Promise.all([refreshDetail(), refreshPosts()]);
    setReply('');
    setReplyAttachments([]);
  };
  const uploadReplyAttachment = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) return false;
    setReplyAttachments((current) => [
      ...current,
      {
        url: uploaded.url as string,
        name: uploaded.filename ?? file.name,
        publicId: uploaded.publicId,
      },
    ]);
    return true;
  };
  const managePost = async (post: IPost, change: { isPinned?: boolean; isLocked?: boolean }) => {
    const response = await mutation(`collaboration/posts/${post._id}`, {
      method: 'PATCH',
      body: change,
    });
    if (!response?.results?.success) return;
    toast.success(
      change.isPinned !== undefined
        ? change.isPinned
          ? 'Pinned for the institution'
          : 'Pin removed'
        : change.isLocked
          ? 'Discussion closed'
          : 'Discussion reopened',
    );
    await Promise.all([
      refreshPosts(),
      detailId === post._id ? refreshDetail() : Promise.resolve(),
    ]);
  };
  const vote = async () => {
    if (!detailId || !selectedVotes.length) return;
    const response = await mutation(`collaboration/posts/${detailId}/vote`, {
      method: 'POST',
      body: { optionIds: selectedVotes },
    });
    if (!response?.results?.success) return;
    toast.success('Vote recorded');
    await Promise.all([refreshDetail(), refreshPosts()]);
    setSelectedVotes([]);
  };
  const createAlbum = async () => {
    const response = await mutation('collaboration/albums', {
      method: 'POST',
      body: { name: albumName, description: albumDescription, scope: 'institution' },
    });
    if (!response?.results?.success) return;
    toast.success('Gallery album created');
    await refreshAlbums();
    setAlbumComposer(false);
    setAlbumName('');
    setAlbumDescription('');
  };
  const uploadMedia = async (file: File) => {
    if (!albumId) return false;
    const formData = new FormData();
    formData.append('file', file);
    const upload = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const saved = upload?.results?.data as
      | { url?: string; filename?: string; publicId?: string; mimetype?: string }
      | undefined;
    if (!saved?.url) return false;
    const response = await mutation(`collaboration/albums/${albumId}/media`, {
      method: 'POST',
      body: {
        title: saved.filename ?? file.name,
        url: saved.url,
        publicId: saved.publicId,
        mimeType: saved.mimetype ?? file.type,
      },
    });
    if (!response?.results?.success) return false;
    setUploadFiles((current) => [
      ...current,
      { url: saved.url as string, name: saved.filename ?? file.name, publicId: saved.publicId },
    ]);
    await Promise.all([refreshAlbumDetail(), refreshAlbums()]);
    return true;
  };
  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const correctTab = tab === 'polls' ? post.type === 'poll' : post.type !== 'poll';
      const matches =
        !query ||
        [post.title, post.content, post.createdByName, post.type].some((value) =>
          value.toLowerCase().includes(query),
        ) ||
        post.attachments.some((file) => file.name.toLowerCase().includes(query));
      return correctTab && matches;
    });
  }, [posts, search, tab]);
  const announcements = posts.filter((post) => post.type === 'announcement').length;
  const openDiscussions = posts.filter(
    (post) => post.type === 'discussion' && !post.isLocked,
  ).length;
  const totalReplies = posts.reduce((sum, post) => sum + post.replyCount, 0);
  const viewerFiles: IViewerFile[] = (albumDetail?.media ?? []).map((media) => ({
    url: media.url,
    name: media.title,
    publicId: media.publicId,
  }));
  return (
    <div className="space-y-6 pb-8">
      <EngagementWorkflowBar />
      {(metadataError || postsError || albumsError) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {metadataError?.message ||
            postsError?.message ||
            albumsError?.message ||
            'Unable to load the collaboration workspace.'}
        </div>
      )}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <MessagesSquare className="h-4 w-4" /> Campus community
          </p>
          <h1 className="text-3xl font-black text-slate-950">Collaboration Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            One place for campus decisions, discussions, polls and shared evidence.
          </p>
        </div>
        {publisher && (
          <div className="flex gap-2">
            {tab === 'gallery' ? (
              <CustomButton
                variant="primary"
                onClick={() => setAlbumComposer(true)}
                startIcon={<Plus className="h-4 w-4" />}
              >
                New album
              </CustomButton>
            ) : (
              <CustomButton
                variant="primary"
                onClick={() => {
                  setType(tab === 'polls' ? 'poll' : 'discussion');
                  setComposer(true);
                }}
                startIcon={<Plus className="h-4 w-4" />}
              >
                Create
              </CustomButton>
            )}
          </div>
        )}
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace summary">
        {[
          {
            label: 'Open discussions',
            value: openDiscussions,
            hint: 'Ready for team input',
            icon: MessageCircle,
            tone: 'bg-blue-50 text-blue-700',
          },
          {
            label: 'Announcements',
            value: announcements,
            hint: 'Institution updates',
            icon: Megaphone,
            tone: 'bg-amber-50 text-amber-700',
          },
          {
            label: 'Team replies',
            value: totalReplies,
            hint: 'Ideas and updates shared',
            icon: Users,
            tone: 'bg-emerald-50 text-emerald-700',
          },
          {
            label: 'Shared albums',
            value: albums.length,
            hint: 'Photos and evidence',
            icon: ImageIcon,
            tone: 'bg-violet-50 text-violet-700',
          },
        ].map((stat) => (
          <article key={stat.label} className="rounded-2xl bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-600">{stat.hint}</p>
              </div>
              <span className={`rounded-xl p-2.5 ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </span>
            </div>
          </article>
        ))}
      </section>
      <nav className="flex gap-1 rounded-2xl bg-white p-1">
        {[
          { key: 'feed' as const, label: 'Discussions' },
          { key: 'polls' as const, label: 'Polls' },
          { key: 'gallery' as const, label: 'Gallery' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-primary text-white' : 'text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-600" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            tab === 'gallery' ? 'Search albums' : 'Search topics, people, content or attachments'
          }
          aria-label="Search collaboration workspace"
          className={`${inputClass} bg-white pl-10`}
        />
      </div>
      {tab !== 'gallery' &&
        (visiblePosts.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {visiblePosts.map((post) => (
              <motion.article
                whileHover={{ y: -2 }}
                key={post._id}
                className="rounded-3xl bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold capitalize ${post.type === 'announcement' ? 'bg-amber-50 text-amber-700' : post.type === 'poll' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}
                    >
                      {post.type}
                    </span>
                    {post.isPinned && (
                      <span className="flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                        <Pin className="h-3 w-3" /> Pinned
                      </span>
                    )}
                    {post.isLocked && (
                      <span className="flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-600">
                    {new Date(post.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-900">{post.title}</h2>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {post.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                    <Eye className="h-3 w-3" /> {scopeLabel(post.scope)}
                  </span>
                  {post.attachments.length > 0 && (
                    <span className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">
                      <Paperclip className="h-3 w-3" /> {post.attachments.length}{' '}
                      {post.attachments.length === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </div>
                {post.type === 'poll' && (
                  <div className="mt-4 space-y-2">
                    {post.pollOptions.map((option) => {
                      const total = post.pollOptions.reduce((sum, item) => sum + item.voteCount, 0);
                      const percentage = total ? Math.round((option.voteCount / total) * 100) : 0;
                      return (
                        <div key={option.id}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span>{option.label}</span>
                            <span>{percentage}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <Box
                              className="h-full rounded-full bg-primary"
                              sx={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-slate-600">
                    By {post.createdByName} · {post.replyCount} replies
                  </span>
                  <button
                    onClick={() => {
                      setDetailId(post._id);
                      setSelectedVotes([]);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <MessageCircle className="h-4 w-4" /> Open
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <section className="rounded-3xl bg-white">
            <Empty
              title={
                search
                  ? 'No matching conversations'
                  : `No ${tab === 'polls' ? 'polls' : 'discussions'} yet`
              }
              subTitle={
                search
                  ? 'Try a person, topic, content word or attachment name.'
                  : publisher
                    ? 'Start with a clear question or update so the right people can contribute.'
                    : 'Nothing has been shared with your role or department yet.'
              }
              pathName={
                publisher && !search
                  ? `Create ${tab === 'polls' ? 'poll' : 'discussion'}`
                  : undefined
              }
              onClick={
                publisher && !search
                  ? () => {
                      setType(tab === 'polls' ? 'poll' : 'discussion');
                      setComposer(true);
                    }
                  : undefined
              }
            />
          </section>
        ))}
      {tab === 'gallery' &&
        (albums.filter((album) =>
          `${album.name} ${album.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
        ).length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {albums
              .filter((album) =>
                `${album.name} ${album.description ?? ''}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((album) => (
                <motion.button
                  whileHover={{ y: -3 }}
                  key={album._id}
                  onClick={() => {
                    setAlbumId(album._id);
                    setUploadFiles([]);
                  }}
                  className="overflow-hidden rounded-3xl bg-white text-left"
                >
                  <div className="grid aspect-video place-items-center bg-slate-100">
                    {album.coverUrl ? (
                      <Image
                        src={album.coverUrl}
                        alt=""
                        width={640}
                        height={360}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-black text-slate-900">{album.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">{album.mediaCount} files</p>
                  </div>
                </motion.button>
              ))}
          </div>
        ) : (
          <section className="rounded-3xl bg-white">
            <Empty
              title={search ? 'No matching albums' : 'No shared albums yet'}
              subTitle={
                search
                  ? 'Try a different album name.'
                  : 'Create an album to keep event photos and institutional evidence together.'
              }
              pathName={publisher && !search ? 'Create album' : undefined}
              onClick={publisher && !search ? () => setAlbumComposer(true) : undefined}
            />
          </section>
        ))}
      {composer && (
        <Modal title={`Create ${type}`} onClose={() => setComposer(false)}>
          <div className="grid gap-4">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as TPostType)}
              className={inputClass}
            >
              {metadata?.postTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className={inputClass}
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              placeholder="Write something useful…"
              className={inputClass}
            />
            {type === 'poll' && (
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.value : value,
                        ),
                      )
                    }
                    placeholder={`Option ${index + 1}`}
                    className={inputClass}
                  />
                ))}
                <button
                  onClick={() => setPollOptions((current) => [...current, ''])}
                  className="text-xs font-bold text-primary"
                >
                  + Add option
                </button>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="datetime-local"
                    value={pollEndsAt}
                    onChange={(event) => setPollEndsAt(event.target.value)}
                    className={inputClass}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowMultipleVotes}
                      onChange={(event) => setAllowMultipleVotes(event.target.checked)}
                    />{' '}
                    Allow multiple choices
                  </label>
                </div>
              </div>
            )}
            <ScopePicker
              metadata={metadata}
              scope={scope}
              setScope={setScope}
              roles={targetRoles}
              setRoles={setTargetRoles}
              departments={targetDepartments}
              setDepartments={setTargetDepartments}
            />
            <InlineFileUpload
              label="Attachments"
              multiple
              files={attachments}
              onUpload={uploadAttachment}
              onRemove={async (_file, index) =>
                setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
            />
            <div className="flex justify-end">
              <CustomButton variant="primary" onClick={createPost} loading={isLoading}>
                Publish
              </CustomButton>
            </div>
          </div>
        </Modal>
      )}
      {detailId && detail && (
        <Modal title={detail.post.title} onClose={() => setDetailId(null)}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span>{scopeLabel(detail.post.scope)}</span>
                <span>·</span>
                <span>Shared by {detail.post.createdByName}</span>
                <span>·</span>
                <span>{new Date(detail.post.createdAt).toLocaleString('en-IN')}</span>
              </div>
              {canManageDetail && (
                <div className="flex gap-2">
                  {moderator && (
                    <button
                      onClick={() => managePost(detail.post, { isPinned: !detail.post.isPinned })}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <Pin className="h-3.5 w-3.5" />
                      {detail.post.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {detail.post.type !== 'poll' && (
                    <button
                      onClick={() => managePost(detail.post, { isLocked: !detail.post.isLocked })}
                      className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {detail.post.isLocked ? 'Reopen' : 'Close'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {detail.post.content}
            </p>
            {detail.post.attachments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Shared files
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.post.attachments.map((file) => (
                    <a
                      key={file.url}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="truncate">{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {detail.post.type === 'poll' && (
              <div className="space-y-2">
                {detail.post.pollOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center justify-between rounded-xl p-3 ${detail.post.myVoteOptionIds.includes(option.id) ? 'bg-emerald-50' : 'bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={detail.post.allowMultipleVotes ? 'checkbox' : 'radio'}
                        name="poll"
                        disabled={detail.post.myVoteOptionIds.length > 0}
                        checked={
                          detail.post.myVoteOptionIds.includes(option.id) ||
                          selectedVotes.includes(option.id)
                        }
                        onChange={() =>
                          setSelectedVotes((current) =>
                            detail.post.allowMultipleVotes
                              ? current.includes(option.id)
                                ? current.filter((id) => id !== option.id)
                                : [...current, option.id]
                              : [option.id],
                          )
                        }
                      />
                      {option.label}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{option.voteCount}</span>
                  </label>
                ))}
                {detail.post.myVoteOptionIds.length === 0 && (
                  <CustomButton variant="primary" onClick={vote}>
                    Submit vote
                  </CustomButton>
                )}
              </div>
            )}
            {detail.post.type !== 'poll' && (
              <>
                <div className="space-y-2">
                  {detail.replies.map((item) => (
                    <div key={item._id} className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-sm text-slate-700">{item.content}</p>
                      {item.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.attachments.map((file) => (
                            <a
                              key={file.url}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-primary"
                            >
                              <Paperclip className="h-3 w-3" /> {file.name}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-600">
                        {item.createdByName} · {new Date(item.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                </div>
                {!detail.post.isLocked && (
                  <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Add context, a decision or a useful update…"
                      rows={3}
                      className={`${inputClass} bg-white`}
                    />
                    <InlineFileUpload
                      label="Supporting files (optional)"
                      multiple
                      files={replyAttachments}
                      onUpload={uploadReplyAttachment}
                      onRemove={async (_file, index) =>
                        setReplyAttachments((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    />
                    <div className="flex justify-end">
                      <CustomButton
                        variant="primary"
                        onClick={sendReply}
                        disabled={!reply.trim()}
                        startIcon={<Send className="h-4 w-4" />}
                      >
                        Post reply
                      </CustomButton>
                    </div>
                  </div>
                )}
                {detail.post.isLocked && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">
                    This discussion is closed. Existing decisions and files remain available to
                    read.
                  </p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
      {albumComposer && (
        <Modal title="Create gallery album" onClose={() => setAlbumComposer(false)}>
          <div className="grid gap-3">
            <input
              value={albumName}
              onChange={(event) => setAlbumName(event.target.value)}
              placeholder="Album name"
              className={inputClass}
            />
            <textarea
              value={albumDescription}
              onChange={(event) => setAlbumDescription(event.target.value)}
              placeholder="Description"
              className={inputClass}
            />
            <CustomButton variant="primary" onClick={createAlbum}>
              Create album
            </CustomButton>
          </div>
        </Modal>
      )}
      {albumId && albumDetail && (
        <Modal title={albumDetail.album.name} onClose={() => setAlbumId(null)} wide>
          <div className="space-y-5">
            {canAddAlbumMedia && (
              <InlineFileUpload
                label="Add photos or documents"
                multiple
                files={uploadFiles}
                onUpload={uploadMedia}
                onRemove={async () => undefined}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {albumDetail.media.map((media, index) => (
                <button
                  key={media._id}
                  onClick={() => {
                    setViewerIndex(index);
                    setViewerOpen(true);
                  }}
                  className="overflow-hidden rounded-2xl bg-slate-100"
                >
                  <Image
                    src={media.url}
                    alt={media.title}
                    width={400}
                    height={400}
                    unoptimized
                    className="aspect-square w-full object-cover"
                  />
                  <p className="truncate p-2 text-xs font-semibold text-slate-700">{media.title}</p>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
      <FileViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        files={viewerFiles}
        initialIndex={viewerIndex}
      />
    </div>
  );
}

function ScopePicker({
  metadata,
  scope,
  setScope,
  roles,
  setRoles,
  departments,
  setDepartments,
}: {
  metadata?: IMetadata;
  scope: TScope;
  setScope: (scope: TScope) => void;
  roles: string[];
  setRoles: (roles: string[]) => void;
  departments: string[];
  setDepartments: (departments: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <select
        value={scope}
        onChange={(event) => setScope(event.target.value as TScope)}
        className={inputClass}
      >
        <option value="institution">Whole institution</option>
        <option value="roles">Selected roles</option>
        <option value="departments">Selected departments</option>
      </select>
      {scope === 'roles' && (
        <div className="flex flex-wrap gap-2">
          {metadata?.roles.map((role) => (
            <button
              key={role.name}
              onClick={() =>
                setRoles(
                  roles.includes(role.name)
                    ? roles.filter((value) => value !== role.name)
                    : [...roles, role.name],
                )
              }
              className={`rounded-lg px-2 py-1 text-xs ${roles.includes(role.name) ? 'bg-primary text-white' : 'bg-slate-100'}`}
            >
              {role.displayName}
            </button>
          ))}
        </div>
      )}
      {scope === 'departments' && (
        <div className="flex flex-wrap gap-2">
          {metadata?.departments.map((department) => (
            <button
              key={department._id}
              onClick={() =>
                setDepartments(
                  departments.includes(department._id)
                    ? departments.filter((value) => value !== department._id)
                    : [...departments, department._id],
                )
              }
              className={`rounded-lg px-2 py-1 text-xs ${departments.includes(department._id) ? 'bg-primary text-white' : 'bg-slate-100'}`}
            >
              {department.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function scopeLabel(scope: TScope) {
  if (scope === 'roles') return 'Selected roles';
  if (scope === 'departments') return 'Selected departments';
  return 'Whole institution';
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-3xl bg-white p-6 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
