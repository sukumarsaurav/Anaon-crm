// Shown in the chat pane only while switching chats; the conversation list stays put.
export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="h-[57px] border-b border-slate-200 bg-white" />
      <div className="flex-1 bg-slate-50 px-4 py-4 space-y-3">
        <div className="h-10 w-1/3 rounded-xl bg-slate-200" />
        <div className="h-10 w-1/2 rounded-xl bg-slate-200 ml-auto" />
        <div className="h-10 w-2/5 rounded-xl bg-slate-200" />
      </div>
      <div className="h-[62px] border-t border-slate-200 bg-white" />
    </div>
  )
}
