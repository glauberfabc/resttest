
ALTER TABLE public.menu_items
ADD COLUMN code text;

-- Adiciona um índice para melhorar a performance de busca pelo código
CREATE INDEX idx_menu_items_code ON public.menu_items(code);
