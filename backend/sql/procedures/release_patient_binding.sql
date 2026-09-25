-- Release the binding for this request's Snowflake session. The web role has
-- procedure usage, not direct UPDATE privileges on PATIENT_BINDING.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.release_patient_binding()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Releases the current session patient binding.'
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
