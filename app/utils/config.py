from configparser import ConfigParser

def get_config(section, key, config_path="./app/config/config.ini"):
    parser = ConfigParser()
    parser.read(config_path)
    return parser.get(section, key)
