-- Realign question IDs if Question 5 was missing and subsequent questions shifted down by 1
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM questions WHERE name_en = 'What is your relationship status?' AND id = 5) THEN
        -- Shift IDs upwards away from 5..13 collision space
        UPDATE questions SET id = id + 1000 WHERE id >= 5;
        UPDATE questions SET id = id - 999 WHERE id >= 1005;
        
        -- Insert missing question 5
        INSERT INTO questions (id, type, answer_type, name_en, name_fa, created_at, updated_at)
        VALUES (5, 'PERSONALITY', 'SINGLE', 'How much would you pay on a weekend?', 'حاظری در یک آخر هفته چقدر پول خرج کنی؟', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;

        -- Insert answers for question 5
        INSERT INTO question_answers (question_id, answer_en, answer_fa, created_at, updated_at)
        VALUES 
            (5, 'Below 10 Dollars.', 'کمتر از 10 دلار.', NOW(), NOW()),
            (5, 'Between 10 to 30 Dollars.', 'بین 10 تا 30 دلار.', NOW(), NOW()),
            (5, 'Between 30 to 50 Dollars.', 'بین 30 تا 50 دلار.', NOW(), NOW()),
            (5, 'More than 50 Dollars.', 'بیشتر از 50 دلار.', NOW(), NOW()),
            (5, 'Depends on my mood.', 'بستگی به حال و هوای من دارد.', NOW(), NOW());

        -- Reset sequence
        PERFORM setval(pg_get_serial_sequence('questions', 'id'), (SELECT COALESCE(MAX(id), 1) FROM questions));
    END IF;
END $$;
