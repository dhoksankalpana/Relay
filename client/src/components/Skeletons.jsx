import { cn } from '../lib/ui';

export function Line({ className }) {
  return <div className={cn('skel h-3', className)} />;
}

export function ThreadRowSkeleton() {
  return (
    <div className="border-b border-hairline px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="skel size-9 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Line className="w-28" />
            <Line className="w-10" />
          </div>
          <Line className="w-3/4" />
          <Line className="w-full opacity-70" />
          <div className="flex gap-2 pt-0.5">
            <div className="skel h-4 w-24 rounded-full" />
            <div className="skel h-4 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThreadListSkeleton({ rows = 6 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <ThreadRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="card p-3">
          <div className="skel h-2.5 w-16" />
          <div className="skel mt-3 h-6 w-10" />
          <div className="skel mt-2 h-2 w-20 opacity-60" />
        </div>
      ))}
    </div>
  );
}

export function ThreadDetailSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="card space-y-3 p-4">
        <div className="skel h-3 w-40" />
        <div className="skel h-4 w-3/4" />
        <div className="space-y-2">
          <div className="skel h-3 w-full" />
          <div className="skel h-3 w-5/6" />
          <div className="skel h-3 w-2/3" />
        </div>
        <div className="flex gap-2">
          <div className="skel h-5 w-32 rounded-full" />
          <div className="skel h-5 w-24 rounded-full" />
        </div>
      </div>
      {[0, 1].map((index) => (
        <div key={index} className="card space-y-2 p-4">
          <div className="flex items-center gap-3">
            <div className="skel size-9 rounded-full" />
            <div className="space-y-1.5">
              <div className="skel h-3 w-32" />
              <div className="skel h-2.5 w-44 opacity-70" />
            </div>
          </div>
          <div className="skel h-3 w-full" />
          <div className="skel h-3 w-11/12" />
          <div className="skel h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function ClientCardSkeleton() {
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <div className="skel size-10 rounded-full" />
        <div className="space-y-2">
          <div className="skel h-3 w-32" />
          <div className="skel h-2.5 w-24 opacity-70" />
        </div>
      </div>
      <div className="skel h-4 w-2/3" />
      <div className="skel h-3 w-full" />
      <div className="skel h-3 w-11/12" />
      <div className="skel h-9 w-56 rounded-lg" />
    </div>
  );
}
