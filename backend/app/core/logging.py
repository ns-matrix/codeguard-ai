import logging
import sys
from datetime import datetime, timezone


class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[1;31m",
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        record.color = color
        record.reset = self.RESET
        return super().format(record)


def setup_logging(level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("codeguard")
    logger.setLevel(getattr(logging, level.upper()))

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)

    fmt = ColorFormatter(
        "%(color)s%(asctime)s%(reset)s | %(color)s%(levelname)-8s%(reset)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(fmt)

    if not logger.handlers:
        logger.addHandler(handler)

    return logger


logger = setup_logging()
