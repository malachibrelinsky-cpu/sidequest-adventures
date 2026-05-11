ALTER TABLE public.quest_participants
  ADD CONSTRAINT quest_participants_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.quest_participants
  ADD CONSTRAINT quest_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.quest_messages
  ADD CONSTRAINT quest_messages_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;