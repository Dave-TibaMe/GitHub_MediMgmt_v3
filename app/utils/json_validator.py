import jsonschema

med_schema = {
    "type": "object",
    "properties": {
        "medications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "dose": {"type": "string"},
                    "frequency": {"type": "string"},
                    "effect": {"type": "string"},
                    "remind_times": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "hour": {"type": "integer"},
                                "minute": {"type": "integer"}
                            }
                        }
                    }
                }
            }
        }
    }
}

def validate_med_json(data):
    try:
        jsonschema.validate(instance=data, schema=med_schema)
        return True
    except jsonschema.ValidationError:
        return False
