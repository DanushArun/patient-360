-- The application has procedure USAGE, not direct UPDATE privileges.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.release_patient_binding()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Releases only the caller current-session patient binding.'
  EXECUTE AS OWNER
AS
$$
BEGIN
    UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING
       SET released_at = CURRENT_TIMESTAMP()
     WHERE session_id = CURRENT_SESSION()
       AND snowflake_user = CURRENT_USER()
       AND released_at IS NULL;
    RETURN OBJECT_CONSTRUCT('released', TRUE);
END;
$$;
