### `pl-drawing-venn` element

A `pl-drawing-venn` element creates a canvas (drawing space) for venn diagrams. Users can directly interact with the canvas for grading, or the canvas can be used similar to an image as a supplement for another question.

#### Sample Element 1 (Not Interactive)
![image](docs/NotInteractive.png)

**question.html**

```html
<pl-drawing-venn gradable="false" width="400" height="400">
    <pl-circle-venn x1="150" y1="150" label="A"></pl-circle-venn>
    <pl-circle-venn x1="250" y1="150" label="B"></pl-circle-venn>
    <pl-circle-venn x1="200" y1="250" label="C"></pl-circle-venn>
    <pl-region-venn region="A&B&C"></pl-region-venn>
</pl-drawing-venn>
```

### Sample Element 2 (Somewhat Interactive)
![image](docs/SomewhatInteractive.png)

```html
<pl-drawing-venn answers-name="venn" disable-labeling="true" disable-movement="true" correct-answer="~(A&B)|C">
    <pl-drawing-venn-initial>
        <pl-circle-venn x1="200" y1="150" label="A"></pl-circle-venn>
        <pl-circle-venn x1="300" y1="150" label="B"></pl-circle-venn>
        <pl-circle-venn x1="250" y1="400" label="C"></pl-circle-venn>
    </pl-drawing-venn-initial>
</pl-drawing-venn>
```

### Sample Element 3 (Fully Interactive)
![image](docs/FullyInteractive.png)

```html
<pl-drawing-venn answers-name="venn" include-sample-space="true" correct-answer="~(A&B)">
    <pl-circle-venn x1="200" y1="150" label="A"></pl-circle-venn>
    <pl-circle-venn x1="300" y1="150" label="B"></pl-circle-venn>
</pl-drawing-venn>
```



#### Customizations

| Attribute                    | Type                                         | Default  | Description                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gradable`               | boolean                                       | true        | `gradable = true` expects circles to be placed, shaded, or labeled in the canvas for grading. When `gradable = false`, the canvas will be used for display only. |
| `answers-name`               | string                                       | —        | Variable name to store data in. Note that this attribute has to be unique within a question, i.e., no value for this attribute should be repeated within a question. This is required if `gradable=true`.|
| `width`               | integer                                       | 500        | Horizontal width of the canvas (in pixels). |
| `height`               | integer                                       | 500        | Vertical height of the canvas (in pixels). |
| `correct-answer`               | string                                       | -        | Correct answer for grading. This should be specified with set operations using the labels of circles (e.g. `A^B`). The allowed set operations include complement (`~` or `!`), union (`_U_`, `_u_`, or `\|`), intersection (`^`, `&`, `_i_` or `_I_`), and set difference (`-`). This can also be specified as a list of unions (e.g. `[A^B, B^C]` is equivalent to `(A^B) \| (B^C)`). |
| `hide-score-badge` | boolean | false | Choose to hide a score badge of either 100% or 0% that will be shown above the canvas based on the student's submission.|
| `hide-answer-panel` | boolean | false | Option to hide the correct answer in the correct panel.|
| `hide-help-text` | boolean | false |Hide the help text that contains the instructions on using the venn-diagram canvas. Instructions will not be shown if `gradable=false`.|
| `circle-radius` | integer | 80 | The radius of the circles placed in the canvas.|
| `disable-insertion` | boolean | false | If true, students will be unable to insert and delete circles in the canvas. This is only relevant when `gradable = true`.|
| `disable-labeling` | boolean | false | If true, students will be unable to label circles in the canvas. This is only relevant when `gradable = true`.|
| `disable-shading` | boolean | false | If true, students will be unable to shade circles in the canvas. This is only relevant when `gradable = true`.|
| `disable-movement` | boolean | false | If true, moving circles within the canvas will not be possible. Additionally, `disable-insertion` will automatically be set to `true` with no ability to specify otherwise. This is only relevant when `gradable = true`.|
| `disable-sample-space` | boolean | false | If true, students will not have the ability to shade the sample space. Additionally, the sample space will not be graded for correctness. This is only relevant when `gradable = true`.|

Inside the `pl-drawing-venn` element, each circle expected in the canvas should be specified with `pl-circle-venn`, which has the following attributes:

| Attribute  | Type    | Default | Description                                                                                                                                    |
| ---------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `x1` | float  | —       | The `x` position of the center of the circle (i.e. the horizontal distance from the left border of the canvas). |
| `y1` | float  | —       | The `y` position of the center of the circle (i.e. the vertical distance from the top border of the canvas). |
| `label` | string  | —       | The label of a circle. Each circle must have a unique label, and the label must be a valid Python identifier.|

Inside the `pl-drawing-venn` element, the regions to be shaded within circles should be specified with `pl-region-venn`, which has the following attributes:

| Attribute  | Type    | Default | Description                                                                                                                                    |
| ---------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `region` | string  | —       |The region to shade. This should be specified with set operations using the labels of circles (e.g. `A^B`). The allowed set operations include complement (`~` or `!`), union (`_U_`, `_u_`, or `\|`), intersection (`^`, `&`, `_i_` or `_I_`), and set difference (`-`).|

### `pl-drawing-venn-initial` element

This element should be used to wrap elements that are initially shown on the canvas when `gradable=true`. (When `gradable=false`, all elements are shown by default, so `pl-drawing-venn-initial` has no effect.)

The example below shows an instance where one circle starts in the canvas and another circle is to be inserted by students.

```html
<pl-drawing-venn answers-name="venn" correct-answer="A^B">

  <pl-drawing-venn-initial>
    <pl-circle-venn x1="100" y1="100" label="A"></pl-circle-venn>
  </pl-drawing-venn-initial>

  <pl-circle-venn x1="200" y1="100" label="B"></pl-circle-venn>
</pl-drawing-venn>
```
