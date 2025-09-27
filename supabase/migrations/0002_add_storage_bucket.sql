-- Create a bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the product_images bucket
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'product_images' );

DROP POLICY IF EXISTS "Allow insert for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow insert for admins and collaborators"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product_images' AND
    (get_my_role() = 'admin' OR get_my_role() = 'collaborator')
  );

DROP POLICY IF EXISTS "Allow update for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow update for admins and collaborators"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product_images' AND
    (get_my_role() = 'admin' OR get_my_role() = 'collaborator')
  );

DROP POLICY IF EXISTS "Allow delete for admins and collaborators" ON storage.objects;
CREATE POLICY "Allow delete for admins and collaborators"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product_images' AND
    (get_my_role() = 'admin' OR get_my_role() = 'collaborator')
  );
