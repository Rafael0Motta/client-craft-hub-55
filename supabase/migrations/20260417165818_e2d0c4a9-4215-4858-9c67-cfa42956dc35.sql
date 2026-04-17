UPDATE auth.users
SET encrypted_password = crypt('qu3r0n3t', gen_salt('bf')),
    updated_at = now()
WHERE email = 'rafael@ooldlab.com';