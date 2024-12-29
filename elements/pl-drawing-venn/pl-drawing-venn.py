from enum import Enum
import json

import chevron
import lxml.html
import prairielearn as pl
import elements
import defaults
import ast
from itertools import combinations

LABEL_DEFAULT = ""
REGION_DEFAULT = ""
GRADABLE_DEFAULT = True
DISABLE_SAMPLE_SPACE_DEFAULT = False
HIDE_HELP_TEXT_DEFAULT = False
HIDE_ANSWER_PANEL_DEFAULT = False
HIDE_SCORE_BADGE_DEFAULT = False
CORRECT_ANSWER_DEFAULT = ''
DISABLE_INSERTION_DEFAULT = False
DISABLE_LABELING_DEFAULT = False
DISABLE_SHADING_DEFAULT = False
DISABLE_MOVEMENT_DEFAULT = False
CIRCLE_RADIUS_DEFAULT = 80


class DisplayType(Enum):
    INLINE = "inline"
    BLOCK = "block"

STRING_INPUT_MUSTACHE_TEMPLATE_NAME = "pl-drawing-venn.mustache"

def drawCircles(el, label_map, objects, count, radius, disable_movement=False):
    label = pl.get_string_attrib(el, "label", "")
    obj = elements.generate(el, el.tag)
    if obj is not None:
        obj["id"] = count
        obj["label"] = label
        obj["radius"] = radius

        obj["selectable"] = not disable_movement
        obj["hasControls"] = not disable_movement
        obj["evented"] = not disable_movement

        label_map[label] = count
        objects.append(obj)
        count += 1
    return (objects, count)

def render_drawing_items(elem, gradable, curid=0):
    objects = []
    regions = []
    label_map = {}
    shown_objects = []
    radius = pl.get_integer_attrib(elem, "circle-radius", CIRCLE_RADIUS_DEFAULT)

    for el in elem:
        if el.tag == 'pl-drawing-venn-initial':
            for child in el:
                if child.tag == "pl-circle-venn" or child.tag == "pl-region-venn":
                    shown_objects.append(child)
    
        elif not gradable:
            if el.tag == "pl-circle-venn" or el.tag == "pl-region-venn":
                shown_objects.append(el)
    
    for el in shown_objects:
        if el.tag == "pl-circle-venn":
            objects, curid = drawCircles(el, label_map, objects, curid, radius) 
        elif el.tag == "pl-region-venn":
            region = pl.get_string_attrib(el, "region", "")
            regions.append(region)
    
    regions_to_shade = get_regions(regions, label_map)

    return (objects, regions_to_shade, curid)
    
    
def render_controls(template, element, button_data):
    gradable = pl.get_boolean_attrib(element, "gradable", GRADABLE_DEFAULT)
    
    markup = []
    for button in button_data:
        if not button["disabled"] and gradable:
            markup.append(chevron.render(
                    template,
                    {
                        "render_button": True,
                        "button_class": button["type_name"],
                        "label": button["label"],
                        "icon": button["icon"],
                        "text": button["text"],
                        "tooltip": button["tooltip"]
                    },
                ).strip()
            )
    return "<br>\n".join(f'<p>{val}</p>\n' for val in markup)

    
def is_valid_python(code):
   try:
       ast.parse(code)
   except SyntaxError:
       return False
   return True

def validate_correct_answers(correct_answers, labels):
    valid_symbols = set(['&', '|', '~', '^', "!", ' ', '(', ')', '-'])
    additional_symbols = {'_i_': '&', '_I_': '&', '_u_': '|', '_U_': '|'}
    for i in range(len(correct_answers)):
        original_answer = correct_answers[i]
        ans = correct_answers[i]
        for symbol in additional_symbols:
            ans = ans.replace(symbol, additional_symbols[symbol])
        ans = ans.replace('^', '&')
        ans = ans.replace("!", '~')
        if len(ans) > 0 and ans[0] == ' ':
            ans = ans[1:]
        correct_answers[i] = ans

        for label in labels:
            ans = ans.replace(label, '&')
        
        if not set(ans) <= valid_symbols:
            raise Exception(f'Invalid characters contained in provided region: "{original_answer}"')
        if not is_valid_python(correct_answers[i]):
            raise Exception(f'The provided region is invalid: "{original_answer}"')
        
    for i in range(len(correct_answers)):
        correct_answers[i] = correct_answers[i].replace('&', ' and ')
        correct_answers[i] = correct_answers[i].replace('|', ' or ')
        correct_answers[i] = correct_answers[i].replace('~', ' not ')
        correct_answers[i] = correct_answers[i].replace('-', ' and not ')


def get_regions(regions, label_map):
    # First verify regions
    validate_correct_answers(regions, label_map.keys())

    # Get all possible overlap regions and check if region is contained in one of the specified regions
    ids = label_map.values()
    all_regions = set()
    for i in range(4):
        all_regions.update(combinations(ids, i))
    
    regions_to_shade = set()
    for potential_region in all_regions:
        is_present = {}
        for label in label_map:
            if label_map[label] in potential_region:
                is_present[label] = True
            else:
                is_present[label] = False
        
        # We already replaced these operators, so we're safe to use them to temporarily represent T/F
        bool_map = {True: '&', False: '|'}
        for region_str in regions:
            for label in label_map:
                region_str = region_str.replace(label, bool_map[is_present[label]])

            region_str = region_str.replace(bool_map[True], str(True))
            region_str = region_str.replace(bool_map[False], str(False))
            
            result = eval(region_str)
            if result:
                regions_to_shade.add(potential_region)

    #regions_to_shade = [list(tup) for tup in regions_to_shade]
    regions_to_shade = [",".join(map(str, tup)) for tup in regions_to_shade]
    return regions_to_shade

def getDrawingRegions(element, original_answers, count = 0): 
    objects = []
    regions = original_answers
    label_map = {}
    circles = []
    radius = pl.get_integer_attrib(element, "circle-radius", CIRCLE_RADIUS_DEFAULT)
    for el in element:
        if el.tag == "pl-circle-venn":
            circles.append(el)
        elif el.tag == "pl-drawing-venn-initial":
            for child in el:
                if child.tag == "pl-circle-venn":
                    circles.append(child)

    for el in circles:
        objects, count = drawCircles(el, label_map, objects, count, radius) 

    regions_to_shade = get_regions(regions, label_map)
    return (objects, regions_to_shade, count)   

def prepare(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    name = pl.get_string_attrib(element, "answers-name", "")

    required_attribs = []
    optional_attribs = ["answers-name", "gradable", "hide-answer-panel", "disable-sample-space", "hide-help-text", "hide-score-badge", "width", "height", "correct-answer", "disable-insertion", "disable-labeling", "disable-shading", "circle-radius", "disable-movement"]
    pl.check_attribs(element, required_attribs, optional_attribs)
    
    hide_answer_panel = pl.get_boolean_attrib(element, "hide-answer-panel", HIDE_ANSWER_PANEL_DEFAULT)
    circle_labels = set()
    correct_answers = []

    gradable = pl.get_boolean_attrib(element, "gradable", GRADABLE_DEFAULT)
    correct_ans = pl.get_string_attrib(element, "correct-answer", CORRECT_ANSWER_DEFAULT)
    circle_radius = pl.get_integer_attrib(element, "circle-radius", CIRCLE_RADIUS_DEFAULT)
    width = pl.get_integer_attrib(element, "width", defaults.element_defaults["width"])
    height = pl.get_integer_attrib(element, "height", defaults.element_defaults["height"])
    
    if circle_radius <= 0:
        raise Exception("Default circle radius must be positive.")
    if circle_radius * 2 >= width or circle_radius * 2 >= height:
        raise Exception("Default circle radius must be smaller than the height and width of the canvas.")
    if gradable:
        pl.check_attribs(element, ["answers-name", "correct-answer"], optional_attribs)
        correct_ans = correct_ans.replace(']', '').replace('[', '')
        answers = correct_ans.split(',')
        for ans in answers:
            correct_answers.append(ans)
    
    circle_elems = []
    shown_objects = set()

    for child in element:
        if child.tag == "pl-drawing-venn-initial":
            for subchild in child:
                if subchild.tag == "pl-circle-venn":
                    circle_elems.append(subchild)
                    shown_objects.add(subchild)

        elif child.tag == "pl-circle-venn":
            circle_elems.append(child)
    
    for child in circle_elems:
        pl.check_attribs(
            child, required_attribs=["label"], optional_attribs=["x1", "y1"]
        )
        label = pl.get_string_attrib(child, "label", LABEL_DEFAULT)

        show_object = child in shown_objects
        x1 = pl.get_float_attrib(child, "x1", None)
        y1 = pl.get_float_attrib(child, "y1", None)

        if (show_object or not hide_answer_panel) and (x1 is None or y1 is None):
            raise Exception("Circles to be placed in the Canvas or shown in the answer panel must have x1 and y1 attributes specified.")

        symbols = ['&', '|', '~', '^', "!", ' ', '(', ')'] + ['_i_', '_I_', '_u_', '_U_']
        if (x1 < 0 or x1 + circle_radius > width) or (y1 < 0 or y1 + circle_radius > height):
            raise Exception("All circles must be placed completely within the canvas.")

        if label in circle_labels:
            raise Exception("All cicle labels must be unique.")
        elif not label.isidentifier():
            raise Exception("All circle labels must be valid Python identifiers.")
        else:
            for s in symbols:
                if s in label:
                    raise Exception(f"Circle label cannot contain the substring {s}")
        circle_labels.add(label)
    
    # Verify answers (modifies correct_answers)
    original_answers = correct_answers.copy()
    correct_answers = ["|".join(f"({val})" for val in correct_answers)]
    validate_correct_answers(correct_answers, circle_labels)
    objects, regions_to_shade, _ = getDrawingRegions(element, original_answers)
    data["correct_answers"][name] = {
        "objects" : objects,
        "shaded_regions": regions_to_shade,
        "ans": correct_answers
    }

    include_sample = not pl.get_boolean_attrib(element, "disable-sample-space", DISABLE_SAMPLE_SPACE_DEFAULT)
    if not include_sample:
        if '' in data["correct_answers"][name]["shaded_regions"]:
            data["correct_answers"][name]["shaded_regions"].remove('')


    data["params"].setdefault("labels", {})
    data["params"]["labels"][name] = list(circle_labels)

    data["params"].setdefault("is_graded", {})
    data["params"]["is_graded"][name] = False

def render(element_html: str, data: pl.QuestionData) -> str:
    element = lxml.html.fragment_fromstring(element_html)
    name = pl.get_string_attrib(element, "answers-name", "")
    gradable = pl.get_boolean_attrib(element, "gradable", GRADABLE_DEFAULT)
    show_help_text = not pl.get_boolean_attrib(element, "hide-help-text", HIDE_HELP_TEXT_DEFAULT)
    show_score_badge = not pl.get_boolean_attrib(element, "hide-score-badge", HIDE_SCORE_BADGE_DEFAULT)
    hide_answer_panel = pl.get_boolean_attrib(element, "hide-answer-panel", HIDE_ANSWER_PANEL_DEFAULT)
    disable_movement = pl.get_boolean_attrib(element, "disable-movement", DISABLE_MOVEMENT_DEFAULT)

    graded = data["params"].get("is_graded", False).get(name, False)

    disable_insert = pl.get_boolean_attrib(element, "disable-insertion", DISABLE_INSERTION_DEFAULT) if not disable_movement else disable_movement
    disable_delete = disable_insert
    disable_label = pl.get_boolean_attrib(element, "disable-labeling", DISABLE_LABELING_DEFAULT)
    disable_shade = pl.get_boolean_attrib(element, "disable-shading", DISABLE_SHADING_DEFAULT)

    format_errors = data["format_errors"].get(name, None)
    valid_for_grading = format_errors is None and graded

    score = None
    if valid_for_grading:
        score = data["partial_scores"].get(name, {}).get("score", None)

    uuid = pl.get_uuid()
    init = None

    # Get template
    with open(STRING_INPUT_MUSTACHE_TEMPLATE_NAME, "r", encoding="utf-8") as f:
        template = f.read()


    button_data = [{"type_name": "insert", "label": "Insert Circle", "disabled": disable_insert, "icon": "bi bi-plus-lg", "text": "Create a circle: <strong>Double click</strong> or click the", "tooltip": "Add Circle"}, 
                   {"type_name": "delete", "label" : "Delete Circle", "disabled": disable_insert, "icon": "bi bi-trash", "text": "Delete a circle: Select a circle and press the <strong>Delete/Backspace</strong> key or click the", "tooltip": "Remove Circle"},
                   {"type_name": "label", "label": "Label Circle", "disabled": disable_label, "icon": "bi bi-textarea-t", "text": "Label a circle: Select a circle and begin typing or click the ", "tooltip": "Label Circle"},
                   {"type_name": "shade", "label": "Enable Shading", "disabled": disable_shade, "icon": "bi bi-paint-bucket", "text": "Shade a region: Hold the <strong>Shift</strong> key and select a region or click the", "tooltip": "Shade Circle"}]
    btn_markup = render_controls(template, element, button_data)
    
    objects, regions_to_shade, _ = render_drawing_items(element, gradable)
    init = {"objects": objects, "shaded_regions": regions_to_shade}
    editable = data["panel"] == "question" and gradable

    

    js_options = {
        "editable": (
            editable
        ),
        "width": pl.get_integer_attrib(
            element, "width", defaults.element_defaults["width"]
        ),
        "height": pl.get_integer_attrib(
            element, "height", defaults.element_defaults["height"]
        ),
        "include_sample_space": not pl.get_boolean_attrib(
            element, "disable-sample-space", DISABLE_SAMPLE_SPACE_DEFAULT
        ),
        "default_radius": pl.get_integer_attrib(
            element, "circle-radius", CIRCLE_RADIUS_DEFAULT
        ),
        "disable_movement": pl.get_boolean_attrib(
            element, "disable-movement", DISABLE_MOVEMENT_DEFAULT
        ),
        "disabled_actions": {
            "insert": disable_insert,
            "delete": disable_delete,
            "label":  disable_label,
            "shade":  disable_shade
        }
    }
    
    html_params = {
        "uuid": uuid,
        "name": name,
        "btn_markup": btn_markup,
        "show_buttons": editable,
        "input_answer": json.dumps(init),
        "options_json": json.dumps(js_options),
        "show_canvas": data["panel"] == "question" or (data["panel"] == "submission" and gradable) or (data["panel"] == "answer" and gradable and not hide_answer_panel),
        "submission": data["panel"] == "submission",
        "help_text": data["panel"] == "question" and gradable and show_help_text,
        "show_score_badge": (data["panel"] == "question" or data["panel"] == "submission") and gradable and show_score_badge,
        "graded": graded,
        "is_100": score == 1 if score is not None else False,
        "is_0": score == 0 if score is not None else False,
        "parse_error": format_errors if (data["panel"] == "question" or data["panel"] == "submission") else None,
        "label": not disable_label,
        "shade": not disable_shade,
        "insert": not disable_insert,
        "delete": not disable_delete,
        "button_data": button_data
    }

    if data["panel"] == "answer":
        if format_errors is not None or not graded:
            html_params["show_canvas"] = False
        else:
            html_params["input_answer"] = json.dumps(data["correct_answers"][name])
    elif name in data["submitted_answers"]:
        html_params["input_answer"] = json.dumps(data["submitted_answers"][name])
    return (chevron.render(template, html_params).strip())


def parse(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    name = pl.get_string_attrib(element, "answers-name", "")
    gradable = pl.get_boolean_attrib(element, "gradable", GRADABLE_DEFAULT)
    if not gradable:
        return
    
    if data["submitted_answers"][name] != '':
        data["submitted_answers"][name] = json.loads(data["submitted_answers"][name])
    

def grade(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    gradable = pl.get_boolean_attrib(element, "gradable", GRADABLE_DEFAULT)

    if not gradable:
        return
    
    name = pl.get_string_attrib(element, "answers-name", "")
    data["params"]["is_graded"][name] = True
    include_sample_space = not pl.get_boolean_attrib(element, "disable-sample-space", DISABLE_SAMPLE_SPACE_DEFAULT)
    
    if name in data["format_errors"] and data["format_errors"][name]:
        data["partial_scores"][name] = {"score": None} 
        return

    id_mapping = {}
    if data["submitted_answers"].get(name, "") == "":
        data["format_errors"][name] = "No circles were added in the diagram."
        data["partial_scores"][name] = {"score": None}
        return data
    
    selected_regions = data["submitted_answers"][name]["shaded_regions"]
    all_regions = data["submitted_answers"][name]["all_regions"]
    deselected_regions = set(all_regions) - set(selected_regions)

    if not include_sample_space:
        if '' in selected_regions:
            selected_regions.remove('')
        if '' in all_regions:
            all_regions.remove('')
        if '' in deselected_regions:
            deselected_regions.remove('')

    objects = data["submitted_answers"][name]['objects']
    labels = data["params"]["labels"][name]
    correct_answers = data["correct_answers"][name]

    student_labels = set()

    if len(objects) != len(labels):
        data["format_errors"][name] = "An incorrect number of circles were used."
        data["partial_scores"][name] = {"score": None}
        return data
    
    for obj in objects:
        # Label wasn't set by the student
        if 'label' not in obj or obj['label'] == '':
            data["format_errors"][name] = "Not all circles were labeled."
            data["partial_scores"][name] = {"score": None}
            return data
        student_labels.add(obj['label'])
        id_mapping[obj['label']] = obj['id']
    
    if set(student_labels) != set(labels):
        data["format_errors"][name] = "The circles were not labeled correctly."
        data["partial_scores"][name] = {"score": None}
        return data
    
    bool_map = {True: '&', False: '|'}

    # Ensure all selected regions are correct
    for region in selected_regions:
        is_present = {}
        for label in labels:
            if region is not None:
                region = region.replace(str(id_mapping[label]), label)
                if label in region:
                    is_present[label] = True
                else:
                    is_present[label] = False
        
        for ans in correct_answers['ans']:
            for label in labels:
                if label is not None:
                    ans = ans.replace(label, bool_map[is_present[label]])
            
            ans = ans.replace(bool_map[True], str(True))
            ans = ans.replace(bool_map[False], str(False))
            result = eval(ans)
            if not result:
                data["partial_scores"][name] = {"score": 0}
                return data
    
    # Ensure all deselected regions are incorrect
    for region in deselected_regions:
        is_present = {}
        for label in labels:
            region = region.replace(str(id_mapping[label]), label)
            if label in region:
                is_present[label] = True
            else:
                is_present[label] = False
        
        for ans in correct_answers['ans']:
            for label in labels:
                ans = ans.replace(label, bool_map[is_present[label]])
            ans = ans.replace(bool_map[True], str(True))
            ans = ans.replace(bool_map[False], str(False))
            result = eval(ans)
            if result:
                data["partial_scores"][name] = {"score": 0}
                return data
    
    data["partial_scores"][name] = {"score": 1}

def test(element_html: str, data: pl.ElementTestData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
