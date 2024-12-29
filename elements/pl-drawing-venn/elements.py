import prairielearn as pl
from defaults import drawing_defaults

# Drawing Elements

elements = {}


class BaseElement:
    def generate(element, data):
        return {}

    def is_gradable():
        return False

    def grade(ref, student, tol, angtol):
        return True

    def grading_name(element):
        return None

    def validate_attributes():
        return True

    def get_attributes():
        """
        Returns a list of attributes that the element may contain.
        """
        return []


class Circle(BaseElement):
    def generate(el, data):
        color = pl.get_color_attrib(el, "color", "grey")
        stroke_color = pl.get_color_attrib(el, "stroke-color", "black")
        return {
            "left": pl.get_float_attrib(el, "x1", drawing_defaults["x1"]),
            "top": pl.get_float_attrib(el, "y1", drawing_defaults["y1"]),
            # "radius": pl.get_float_attrib(el, "radius", drawing_defaults["radius"]),
            "radius": drawing_defaults["radius"],
            "stroke": stroke_color,
            "fill": color,
            "opacity": pl.get_float_attrib(el, "opacity", drawing_defaults["opacity"]),
            "selectable": False,
            "hasControls": False,
        }

    def get_attributes():
        return [
            "x1",
            "y1",
            "radius",
            "opacity",
            "color",
            "stroke-color",
            "stroke-width",
            "label",
            "offsetx",
            "offsety",
            "selectable",
        ]

elements["pl-circle-venn"] = Circle

# Store elements that have been registered via extensions
registered_elements = {}

# Helper Functions
def generate(element, name, defaults={}):
    if name in elements:
        obj = defaults.copy()
        cls = elements[name]
        data = registered_elements.get(name, [])
        obj.update(cls.generate(element, data))

        # By default, set the grading name to the element name
        gradingName = cls.grading_name(element)
        if gradingName is None:
            gradingName = name

        #obj["gradingName"] = gradingName
        #obj["type"] = gradingName
        return obj
    else:
        return {}


def register_extension(name, module, data):
    data_obj = {
        "clientFilesUrl": data["options"]
        .get("client_files_extensions_url", {})
        .get(name, None)
    }
    for elem_name, elem in module.elements.items():
        registered_elements[elem_name] = data_obj
        elements[elem_name] = elem