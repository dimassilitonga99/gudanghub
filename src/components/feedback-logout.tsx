import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { callApi } from '@/lib/api';
import { ROUTES } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

interface FeedbackLogoutProps {
  children: React.ReactElement;
}

/**
 * Membungkus tombol keluar: sebelum logout, tampilkan popover feedback
 * (rating bintang + komentar) sesuai PRD feedback.md, teks bahasa Indonesia.
 */
export function FeedbackLogout({ children }: FeedbackLogoutProps) {
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [feedback, setFeedback] = React.useState('');
  const [sent, setSent] = React.useState(false);

  const performLogout = React.useCallback(() => {
    setOpen(false);
    logout();
    navigate(ROUTES.login);
  }, [logout, navigate]);

  const submitAndLogout = () => {
    if (rating < 1 || sent) return;
    setSent(true);
    // Kirim fire-and-forget — logout tetap jalan walau gagal/offline
    void callApi(
      'submitFeedback',
      {
        rating,
        pesan: feedback.trim(),
        username: session?.username || '',
        nama: session?.nama || '',
        idCabang: session?.idCabang || '',
      },
      { dedupe: false, cache: false, timeout: 15000, maxRetries: 1 },
    ).catch(() => {});
    toast.success('Terima kasih atas masukan Anda!', { duration: 2500 });
    setTimeout(performLogout, 500);
  };

  const resetState = () => {
    setRating(0);
    setFeedback('');
    setSent(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetState();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle>Berikan Masukan</PopoverTitle>
          <PopoverDescription>
            Sebelum keluar, bantu kami meningkatkan GudangHub
          </PopoverDescription>
        </PopoverHeader>
        <PopoverBody className="space-y-4">
          <div>
            <Label className="text-sm">Bagaimana pengalaman Anda?</Label>
            <div className="mt-2 flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`Beri ${star} bintang`}
                  className={cn(
                    'h-6 w-6 rounded-full text-lg transition-colors hover:bg-accent',
                    star <= rating ? 'text-yellow-400' : 'text-gray-300',
                  )}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="feedback-text" className="text-sm">
              Komentar Tambahan
            </Label>
            <Textarea
              id="feedback-text"
              placeholder="Ceritakan pengalaman Anda menggunakan GudangHub..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>
        </PopoverBody>
        <PopoverFooter className="grid-cols-2">
          <Button variant="outline" size="sm" onClick={performLogout}>
            Lewati
          </Button>
          <Button size="sm" disabled={rating < 1 || sent} onClick={submitAndLogout}>
            {sent ? 'Mengirim...' : 'Kirim & Keluar'}
          </Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
