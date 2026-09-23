import { createClient } from '@/lib/supabase/server';
import ReplacementTable from '@/components/ReplacementTable';
import type { Replacement } from '@/lib/types';

export const metadata = { title: 'Замены' };

export default async function ReplacementsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('replacements')
    .select('*')
    .order('r_date', { ascending: false })
    .order('lesson', { ascending: true })
    .limit(500);

  const rows = (data as Replacement[] | null) ?? [];
  // Дата последнего изменения = максимальный created_at среди загруженных строк.
  const updatedAt = rows.reduce<string>(
    (max, r) => (r.created_at > max ? r.created_at : max),
    ''
  );

  return (
    <>
      {error && (
        <p className="card mb-4 p-4 text-sm text-rose-600">
          Не удалось загрузить замены. Попробуйте обновить страницу.
        </p>
      )}
      <ReplacementTable rows={rows} updatedAt={updatedAt} />
    </>
  );
}
