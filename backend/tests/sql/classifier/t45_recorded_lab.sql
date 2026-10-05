EXECUTE IMMEDIATE $$
DECLARE
    v_record VARIANT;
    v_clinical VARIANT;
BEGIN
    v_record := (CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('What platelet value is recorded?'));
    v_clinical := (CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('Should treatment proceed?'));
    RETURN OBJECT_CONSTRUCT('test_id','t45_recorded_lab',
        'result',IFF(v_record:classification::VARCHAR='CLASS_B'
            AND v_clinical:classification::VARCHAR='CLASS_A','PASS','FAIL'),
        'record',v_record,'clinical',v_clinical);
END;
$$;
