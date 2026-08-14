import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ConfirmOptions {
  icon?: string;
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
  okVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  showNumber?: boolean;
  numberValue?: number;
}

interface DialogState {
  kind: 'confirm' | 'prompt';
  options: PromptOptions;
  resolve: (value: string | { text: string; number: number } | boolean | null) => void;
}

let activeResolve: ((v: unknown) => void) | null = null;

export function useDialog() {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      activeResolve = resolve as (v: unknown) => void;
      setState({ kind: 'confirm', options, resolve: resolve as never });
    });
  }, []);

  const prompt = useCallback(
    (options: PromptOptions = {}): Promise<string | { text: string; number: number } | null> => {
      return new Promise((resolve) => {
        activeResolve = resolve as (v: unknown) => void;
        setState({ kind: 'prompt', options, resolve: resolve as never });
      });
    },
    [],
  );

  const close = useCallback((value: unknown) => {
    if (activeResolve) {
      activeResolve(value);
      activeResolve = null;
    }
    setState(null);
  }, []);

  const dialog = state ? (
    <Dialog open onOpenChange={(v) => !v && close(null)}>
      <DialogContent className="sm:max-w-md">
        {state.kind === 'confirm' ? (
          <ConfirmBody options={state.options} onClose={() => close(false)} onOk={() => close(true)} />
        ) : (
          <PromptBody options={state.options} onClose={() => close(null)} onOk={(v) => close(v)} />
        )}
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, prompt, dialog };
}

function ConfirmBody({
  options,
  onClose,
  onOk,
}: {
  options: ConfirmOptions;
  onClose: () => void;
  onOk: () => void;
}) {
  const okVariant = options.okVariant || 'default';
  return (
    <>
      <DialogHeader>
        <div className="text-center text-4xl">{options.icon || '⚠️'}</div>
        <DialogTitle className="text-center text-base">{options.title || 'Konfirmasi'}</DialogTitle>
        <DialogDescription className="whitespace-pre-line text-left">
          {options.message || 'Apakah Anda yakin?'}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {options.cancelText || 'Batal'}
        </Button>
        <Button variant={okVariant} onClick={onOk}>
          {options.okText || 'Ya, Lanjut'}
        </Button>
      </DialogFooter>
    </>
  );
}

function PromptBody({
  options,
  onClose,
  onOk,
}: {
  options: PromptOptions;
  onClose: () => void;
  onOk: (value: string | { text: string; number: number } | null) => void;
}) {
  const [text, setText] = useState(options.defaultValue || '');
  const [number, setNumber] = useState(options.numberValue ?? 1);
  const okVariant = options.okVariant || 'default';

  const submit = () => {
    if (options.required && !text.trim()) {
      toast.warning('Isian wajib diisi.');
      return;
    }
    if (options.showNumber) {
      onOk({ text: text.trim(), number: Math.max(1, parseInt(String(number), 10) || 1) });
    } else {
      onOk(text.trim());
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="text-center text-4xl">{options.icon || '📝'}</div>
        <DialogTitle className="text-center text-base">{options.title || 'Input'}</DialogTitle>
        <DialogDescription className="whitespace-pre-line text-left">
          {options.message || ''}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {options.showNumber && (
          <Input
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
            className="text-base"
          />
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={options.placeholder || ''}
          rows={options.showNumber ? 2 : 3}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {options.cancelText || 'Batal'}
        </Button>
        <Button variant={okVariant} onClick={submit}>
          {options.okText || 'Konfirmasi'}
        </Button>
      </DialogFooter>
    </>
  );
}