-- Delete related data first (foreign key references)
DELETE FROM document_annotations WHERE document_id IN (SELECT id FROM documents WHERE lower(author) LIKE '%william branham%');
DELETE FROM document_summaries WHERE document_id IN (SELECT id FROM documents WHERE lower(author) LIKE '%william branham%');
DELETE FROM reading_progress WHERE document_id IN (SELECT id FROM documents WHERE lower(author) LIKE '%william branham%');

-- Delete the documents
DELETE FROM documents WHERE lower(author) LIKE '%william branham%';