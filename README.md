


# Canvas Grader

This is an AI assisted grading tool for canvas assignments. All interactions are made via the canvas api. You need to provide your users canvas token in the `CANVAS_TOKEN` environment variable.

This tool uses ai to generate reports and recomendatations for specific rubric items. A human needs to review the reports and make a grading decision.

This tool loads data in bulk, which makes it faster than speedgrader.

## Running the Flake

[Install Nix first](https://nixos.org/download/) (multi-user recommended)

Make a directory to store your run script and all the downloaded submission data (`./storage` and `./temp` folders will be created automatically).

Make a `run.sh` script with the following:
```bash
Make a `run.sh` script with the following:
```bash
#!/bin/bash
export CANVAS_TOKEN=tokenvalue
export AI_URL=openai compatible url
export AI_TOKEN=auth token
export AI_MODEL=model with tool calling and structured output
export AI_IMAGE_MODEL=model with image support for transcribing images

# Check if --update flag is passed
if [[ "$1" == "--update" ]]; then
  nix run --refresh github:alexmickelson/canvasGrader#production
else
  nix run github:alexmickelson/canvasGrader#production
fi
```

Make it executable and run from the directory where you want your data stored:
```bash
chmod +x run.sh
./run.sh              # Normal run (uses cached version)
./run.sh --update     # Force update from GitHub
```
```

<!-- ### Without Cloning

You can run the application directly without cloning the repository using Nix flakes:

Make sure to set your `CANVAS_TOKEN` environment variable before running:

```bash
export CANVAS_TOKEN=your_canvas_token_here
nix run --refresh github:alexmickelson/canvasGrader#production
```

### Local Development
 -->
