interface ToastItem {
  id: number;
  msg: string;
  type: 'success' | 'error';
}

interface ToastProps {
  toasts: ToastItem[];
}

export default function Toast({ toasts }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`p-4 rounded-lg text-white ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
