import { toast } from 'sonner';
import { SETTINGS } from './config';

type ToastOptions = string | { description?: string; duration?: number };

// Durasi default sesuai SETTINGS (vanilla: sukses 3000ms, error 5000ms)
// Signature drop-in untuk sonner toast.success/toast.error

function resolveOptions(options: ToastOptions | undefined, defaultDuration: number) {
  if (typeof options === 'string') {
    return { description: options, duration: defaultDuration };
  }
  return { ...options, duration: options?.duration ?? defaultDuration };
}

export function toastSuccess(message: string, options?: ToastOptions): string | number {
  return toast.success(message, resolveOptions(options, SETTINGS.toastDuration));
}

export function toastError(message: string, options?: ToastOptions): string | number {
  return toast.error(message, resolveOptions(options, SETTINGS.toastDurationError));
}

export function toastWarning(message: string, options?: ToastOptions): string | number {
  return toast.warning(message, resolveOptions(options, SETTINGS.toastDuration));
}

export function toastInfo(message: string, options?: ToastOptions): string | number {
  return toast.info(message, resolveOptions(options, SETTINGS.toastDuration));
}