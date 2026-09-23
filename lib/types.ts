// Типы данных tavrichka-wiki — соответствуют таблицам Supabase.

export interface Profile {
  id: string;
  role: 'student' | 'admin' | 'moderator';
  display_name?: string;
}

export interface Replacement {
  id: number;
  r_date: string;
  group_name: string;
  lesson: number;
  subject: string;
  change_type: string;
  teacher: string;
  cabinet: string;
  note: string;
  created_at: string;
}

export interface ScheduleRow {
  id: number;
  date: string;
  week_type: 'числитель' | 'знаменатель';
  day_week: string;
  lesson: number;
  group_name: string;
  subject: string;
  teacher: string;
  cabinet: string;
  created_at: string;
}

export interface Teacher {
  id: number;
  full_name: string;
  subject: string;
  cabinet: string;
  email: string;
  consultation: string;
  description: string;
  status: 'published' | 'hidden';
  created_at: string;
}

export interface TeacherEdit {
  id: number;
  teacher_id: number;
  field: string;
  old_value: string;
  new_value: string;
  comment: string;
  author_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Post {
  id: number;
  type: 'news' | 'meme' | 'announce' | 'useful' | 'event';
  title: string;
  content: string;
  image_url: string;
  author_id: string;
  status: 'pending' | 'published' | 'hidden';
  created_at: string;
}

export interface MapObject {
  id: number;
  name: string;
  floor: number;
  room: string;
  category: string;
  description: string;
  corpus: number;
}

export interface MapFloor {
  id: number;
  title: string;
  corpus: number;
  floor: number;
  image_url: string;
  sort: number;
}

export interface LessonTime {
  lesson: number;
  start_time: string;
  end_time: string;
}
