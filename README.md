


# Canvas Grader

This is an AI assisted grading tool for canvas assignments. All interactions are made via the canvas api. You need to provide your users canvas token in the `CANVAS_TOKEN` environment variable.

This tool uses ai to generate reports and recomendatations for specific rubric items. A human needs to review the reports and make a grading decision.

This tool loads data in bulk, which makes it faster than speedgrader.

## Running the Flake

### Without Cloning

You can run the application directly without cloning the repository using Nix flakes:

Make sure to set your `CANVAS_TOKEN` environment variable before running:

```bash
export CANVAS_TOKEN=your_canvas_token_here
nix run github:alexmickelson/canvasGrader#production
```

### Local Development

