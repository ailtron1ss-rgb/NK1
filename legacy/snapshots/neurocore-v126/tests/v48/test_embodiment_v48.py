import pytest
import torch
from neurocore.v48 import PhoneTelemetryAdapterV48, SensorFrameV48


def test_phone_adapter_requires_correct_channel_shapes():
    a=PhoneTelemetryAdapterV48()
    with pytest.raises(ValueError):
        a.ingest(SensorFrameV48(100,1,{"imu":[0,1,2]}))


def test_phone_adapter_rejects_nonfinite_measurements():
    a=PhoneTelemetryAdapterV48()
    with pytest.raises(ValueError):
        a.ingest(SensorFrameV48(100,1,{"battery":[float('nan')]}))


def test_phone_adapter_never_fakes_missing_channels():
    a=PhoneTelemetryAdapterV48(max_age_ms=100)
    a.ingest(SensorFrameV48(100,1,{"battery":[0.7]}))
    vec,mask=a.vector_and_mask(now_ms=100)
    assert vec.shape[0]==a.feature_dim
    assert float(mask.sum().item())==1.0
    # Missing channels are zero-valued but masked out.
    assert float(mask[6].item())==1.0
    assert float(mask[:6].sum().item())==0.0
    assert float(mask[7:].sum().item())==0.0


def test_phone_adapter_marks_stale_measurement_invalid():
    a=PhoneTelemetryAdapterV48(max_age_ms=50)
    a.ingest(SensorFrameV48(100,1,{"battery":[0.8]}))
    _,mask=a.vector_and_mask(now_ms=200)
    assert float(mask[6].item())==0.0


def test_phone_adapter_health_reports_completeness_and_freshness():
    a=PhoneTelemetryAdapterV48(max_age_ms=100)
    h=a.ingest(SensorFrameV48(100,1,{"battery":[0.8],"imu":[0,0,0,0,0,0]}))
    assert h.received_channels==2
    assert h.expected_channels==6
    assert h.complete_fraction==2/6
    assert h.fresh_fraction==2/6


def test_phone_adapter_interoception_is_data_plus_mask():
    a=PhoneTelemetryAdapterV48()
    a.ingest(SensorFrameV48(100,1,{"battery":[0.9],"thermal":[0.2],"cpu_load":[0.4],"memory_pressure":[0.3]}))
    x=a.interoception(100)
    assert x.shape[0]==8
    assert torch.isfinite(x).all()


def test_phone_adapter_roundtrip():
    a=PhoneTelemetryAdapterV48()
    a.ingest(SensorFrameV48(100,4,{"battery":[0.9],"imu":[1,2,3,4,5,6]}))
    state=a.state_dict(); b=PhoneTelemetryAdapterV48(); b.load_state_dict(state)
    va,ma=a.vector_and_mask(100); vb,mb=b.vector_and_mask(100)
    assert torch.allclose(va,vb); assert torch.allclose(ma,mb); assert b.sequence_id==4
