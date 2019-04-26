import SplitEditor from './split.js';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import DiffMatchPatch from 'diff-match-patch';

export default class DiffComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: this.props.value,
    };
    this.onChange = this.onChange.bind(this);
    this.diff = this.diff.bind(this);
  }

  componentDidUpdate() {
    const { value } = this.props;

    if (value !== this.state.value) {
      this.setState({ value });
    }
  }

  onChange(value) {
    this.setState({
      value: value,
    });
    if (this.props.onChange) {
      this.props.onChange(value);
    }
  }

  diff() {
    const dmp = new DiffMatchPatch();

    const markers = [];
    for (let i = 0; i < this.state.value.length; i++) {
      markers[i] = [];
    }

    for (let i = 0; i < this.state.value.length; i++) {
      const lhString = this.state.value[i];
      for (let j = 0; j < this.state.value.length; j++) {
        const rhString = this.state.value[j];
        if (i < j) {
          const diff = dmp.diff_main(lhString, rhString);
          dmp.diff_cleanupSemantic(diff);

          if (lhString.length === 0 && rhString.length === 0) {
            markers.push({});
            continue;
          }

          const diffedLines = this.generateDiffedLines(diff);
          const codeEditorSettings = this.setCodeMarkers(diffedLines, [i, j]);
          markers[i][j] = [codeEditorSettings[0], codeEditorSettings[1]];
        }
      }
    }

    return markers;
  }

  generateDiffedLines(diff) {
    const C = {
      DIFF_EQUAL: 0,
      DIFF_DELETE: -1,
      DIFF_INSERT: 1,
    };

    const diffedLines = {
      left: [],
      right: [],
    };

    const cursor = {
      left: { row: 1, col: 1 },
      right: { row: 1, col: 1 },
    };

    diff.forEach(chunk => {
      const chunkType = chunk[0];
      const text = chunk[1];
      let lines = text.split('\n').length - 1;

      // diff-match-patch sometimes returns empty strings at random
      if (text.length === 0) {
        return;
      }

      const firstChar = text[0];
      const lastChar = text[text.length - 1];
      const lastLineLength = text.length - text.lastIndexOf('\n') - 1;
      let linesToHighlight = 0;

      switch (chunkType) {
        case C.DIFF_EQUAL:
          if (lines !== 0) {
            cursor.left.col = 1;
            cursor.right.col = 1;
          }
          cursor.left.row += lines;
          cursor.left.col += lastLineLength;
          cursor.right.row += lines;
          cursor.right.col += lastLineLength;

          break;
        case C.DIFF_DELETE:
          // If the deletion starts with a newline, push the cursor down to that line
          if (firstChar === '\n') {
            cursor.left.row++;
            cursor.left.col = 1;
            lines--;
          }

          linesToHighlight = lines;

          // If the deletion does not include a newline, highlight the same line on the right
          if (linesToHighlight === 0) {
            diffedLines.right.push({
              startLine: cursor.right.row,
              endLine: cursor.right.row,
              type: 'line',
            });
          }

          // If the last character is a newline, we don't want to highlight that line
          if (lastChar === '\n') {
            linesToHighlight -= 1;
          }

          diffedLines.left.push({
            startLine: cursor.left.row,
            endLine: cursor.left.row + linesToHighlight,
            type: 'line',
          });

          if (this.props.enableLineSegments && (cursor.left.col > 1 || linesToHighlight === 0)) {
            diffedLines.left.push({
              startLine: cursor.left.row,
              startCharacter: cursor.left.col,
              endLine: cursor.left.row + linesToHighlight,
              endCharacter: lastLineLength + (linesToHighlight === 0 ? cursor.left.col : 0),
              type: 'line-segment',
            });
          }

          cursor.left.row += lines;
          cursor.left.col += lastLineLength;
          break;
        case C.DIFF_INSERT:
          // If the insertion starts with a newline, push the cursor down to that line
          if (firstChar === '\n') {
            cursor.right.row++;
            cursor.right.col = 1;
            lines--;
          }

          linesToHighlight = lines;

          // If the insertion does not include a newline, highlight the same line on the left
          if (linesToHighlight === 0) {
            diffedLines.left.push({
              startLine: cursor.left.row,
              endLine: cursor.left.row,
              type: 'line',
            });
          }

          // If the last character is a newline, we don't want to highlight that line
          if (lastChar === '\n') {
            linesToHighlight -= 1;
          }

          diffedLines.right.push({
            startLine: cursor.right.row,
            endLine: cursor.right.row + linesToHighlight,
            type: 'line',
          });

          if (this.props.enableLineSegments && (cursor.right.col > 1 || linesToHighlight === 0)) {
            diffedLines.right.push({
              startLine: cursor.right.row,
              startCharacter: cursor.right.col,
              endLine: cursor.right.row + linesToHighlight,
              endCharacter: lastLineLength + (linesToHighlight === 0 ? cursor.right.col : 0),
              type: 'line-segment',
            });
          }

          cursor.right.row += lines;
          cursor.right.col += lastLineLength;
          break;
        default:
          throw new Error('Diff type was not defined.');
      }
    });
    return diffedLines;
  }

  // Receives a collection of line numbers and iterates through them to highlight appropriately
  // Returns an object that tells the render() method how to display the code editors
  setCodeMarkers(diffedLines = { left: [], right: [] }, indices) {
    const codeEditorSettings = [];

    const newMarkerSet = {
      left: [],
      right: [],
    };

    for (let i = 0; i < diffedLines.left.length; i++) {
      let markerObj;
      if (diffedLines.left[i].type === 'line') {
        markerObj = {
          startRow: diffedLines.left[i].startLine - 1,
          endRow: diffedLines.left[i].endLine,
          type: 'text',
          className: 'codeMarker ' + this.props.markerClassNames[indices[0]],
        }
      } else {
        markerObj = {
          startRow: diffedLines.left[i].startLine - 1,
          startCol: diffedLines.left[i].startCharacter - 1,
          endRow: diffedLines.left[i].endLine - 1,
          endCol: diffedLines.left[i].endCharacter - 1,
          type: 'text',
          className: 'codeMarker codeMarker-lineSegment ' + this.props.markerClassNames[indices[0]],
        };
      }
      newMarkerSet.left.push(markerObj);
    }

    for (let i = 0; i < diffedLines.right.length; i++) {
      let markerObj;
      if (diffedLines.right[i].type === 'line') {
        markerObj = {
          startRow: diffedLines.right[i].startLine - 1,
          endRow: diffedLines.right[i].endLine,
          type: 'text',
          className: 'codeMarker ' + this.props.markerClassNames[indices[1]],
        }
      } else {
        markerObj = {
          startRow: diffedLines.right[i].startLine - 1,
          startCol: diffedLines.right[i].startCharacter - 1,
          endRow: diffedLines.right[i].endLine - 1,
          endCol: diffedLines.right[i].endCharacter - 1,
          type: 'text',
          className: 'codeMarker codeMarker-lineSegment ' + this.props.markerClassNames[indices[1]],
        };
      }
      newMarkerSet.right.push(markerObj);
    }

    codeEditorSettings[0] = newMarkerSet.left;
    codeEditorSettings[1] = newMarkerSet.right;

    return codeEditorSettings;
  }

  lineSkips(source, targets) {
    const rows = {};
    for (let sourceRow = 0; sourceRow < source.lines; sourceRow++) {
      rows[sourceRow] = [];
    }
    const rangeContains = index => range => index >= range.startRow && index < range.endRow;
    for (const targetIndex in targets) {
      const target = targets[targetIndex];
      for (let sourceRow = 0, targetRow = -1; sourceRow < source.lines; sourceRow++) {
        const markedOnSource = source.markers.find(rangeContains(sourceRow));
        const markedOnTarget = target.markers.find(rangeContains(targetRow + 1));
        if ((!markedOnSource && !markedOnTarget) || (markedOnSource && markedOnTarget)) {
          rows[sourceRow][targetIndex] = ++targetRow;
        } else if (markedOnSource) {
          rows[sourceRow][targetIndex] = targetRow;
        } else if (markedOnTarget) {
          sourceRow--;
          targetRow++;
        }
      }
    }
    return rows;
  }

  scrollSyncLines(diff) {
    const lineSkips = [];

    for (let i = 0; i < this.props.value.length; i++) {
      const targets = {};
      const source = { index: i, markers: diff[i], lines: this.props.value[i].split('\n').length };
      for (let j = 0; j < this.props.value.length; j++) {
        if (i !== j) {
          targets[j] = { index: j, markers: diff[j], lines: this.props.value[j].split('\n').length };
        }
      }
      lineSkips.push(this.lineSkips(source, targets));
    }

    return lineSkips;
  }

  flattenDiffs(diffs) {
    const markers = [];
    for (let i = 0; i < diffs.length; i++) {
      markers[i] = [];
    }
    const markerEquals = marker1 => marker2 =>
      marker1.startRow === marker2.startRow &&
      marker1.startCol === marker2.startCol &&
      marker1.endRow === marker2.endRow &&
      marker1.endCol === marker2.endCol;
    const markerOverlaps = marker1 => marker2 =>
      (marker1.startRow <= marker2.startRow && marker1.endRow >= marker2.startRow && ((!marker1.startCol && !marker2.startCol && !marker1.endCol) || (marker1.startCol <= marker2.startCol && marker1.endCol >= marker2.startCol))) ||
      (marker2.startRow <= marker1.startRow && marker2.endRow >= marker1.startRow && ((!marker2.startCol && !marker1.startCol && !marker2.endCol) || (marker2.startCol <= marker1.startCol && marker2.endCol >= marker1.startCol)));
    for (let i = 0; i < diffs.length; i++) {
      for (let j = 0; j < diffs.length; j++) {
        if (diffs[i][j]) {
          markers[i] = [...markers[i], ...diffs[i][j][0]];
          markers[j] = [...markers[j], ...diffs[i][j][1]];
        }
      }
    }
    return markers.map(arr => arr.reduce((accumulator, currentMarker) => {
      const overlappedMarker = accumulator.find(markerOverlaps(currentMarker));
      if (overlappedMarker) {
        overlappedMarker.startRow = Math.min(currentMarker.startRow, overlappedMarker.startRow);
        overlappedMarker.startCol = Math.min(currentMarker.startCol, overlappedMarker.startCol);
        overlappedMarker.endRow = Math.max(currentMarker.endRow, overlappedMarker.endRow);
        overlappedMarker.endCol = Math.max(currentMarker.endCol, overlappedMarker.endCol);
      } else if (!accumulator.find(markerEquals(currentMarker))) {
        accumulator.push(currentMarker);
      }
      return accumulator;
    }, []));
  }

  render() {
    const markers = this.flattenDiffs(this.diff());
    const lineSkips = this.props.enableScrollSync ? this.scrollSyncLines(markers) : [];
    if (this.props.noDiffRender && !markers.find(arr => arr.length > 0)) {
      return this.props.noDiffRender;
    }
    return (
      <SplitEditor
        name={this.props.name}
        className={this.props.className}
        focus={this.props.focus}
        orientation={this.props.orientation}
        splits={this.props.splits}
        mode={this.props.mode}
        theme={this.props.theme}
        height={this.props.height}
        width={this.props.width}
        fontSize={this.props.fontSize}
        showGutter={this.props.showGutter}
        onChange={this.onChange}
        onPaste={this.props.onPaste}
        onLoad={this.props.onLoad}
        onScroll={this.props.onScroll}
        minLines={this.props.minLines}
        maxLines={this.props.maxLines}
        readOnly={this.props.readOnly}
        highlightActiveLine={this.props.highlightActiveLine}
        showPrintMargin={this.props.showPrintMargin}
        tabSize={this.props.tabSize}
        cursorStart={this.props.cursorStart}
        editorProps={this.props.editorProps}
        style={this.props.style}
        scrollMargin={this.props.scrollMargin}
        setOptions={this.props.setOptions}
        wrapEnabled={this.props.wrapEnabled}
        enableBasicAutocompletion={this.props.enableBasicAutocompletion}
        enableLiveAutocompletion={this.props.enableLiveAutocompletion}
        enableScrollSync={this.props.enableScrollSync}
        scrollSyncLines={lineSkips}
        value={this.state.value}
        markers={markers}
      />
    );
  }
}

DiffComponent.propTypes = {
  cursorStart: PropTypes.number,
  editorProps: PropTypes.object,
  enableBasicAutocompletion: PropTypes.bool,
  enableLiveAutocompletion: PropTypes.bool,
  focus: PropTypes.bool,
  fontSize: PropTypes.number,
  height: PropTypes.string,
  highlightActiveLine: PropTypes.bool,
  maxLines: PropTypes.func,
  minLines: PropTypes.func,
  mode: PropTypes.string,
  name: PropTypes.string,
  className: PropTypes.string,
  onLoad: PropTypes.func,
  onPaste: PropTypes.func,
  onScroll: PropTypes.func,
  onChange: PropTypes.func,
  orientation: PropTypes.string,
  readOnly: PropTypes.bool,
  scrollMargin: PropTypes.array,
  setOptions: PropTypes.object,
  showGutter: PropTypes.bool,
  showPrintMargin: PropTypes.bool,
  splits: PropTypes.number,
  style: PropTypes.object,
  tabSize: PropTypes.number,
  theme: PropTypes.string,
  value: PropTypes.array,
  width: PropTypes.string,
  wrapEnabled: PropTypes.bool,
  enableLineSegments: PropTypes.bool,
  enableScrollSync: PropTypes.bool,
  markerClassNames: PropTypes.array,
  noDiffRender: PropTypes.object,
};

DiffComponent.defaultProps = {
  cursorStart: 1,
  editorProps: {},
  enableBasicAutocompletion: false,
  enableLiveAutocompletion: false,
  focus: false,
  fontSize: 12,
  height: '500px',
  highlightActiveLine: true,
  maxLines: null,
  minLines: null,
  mode: '',
  name: 'brace-editor',
  onLoad: null,
  onScroll: null,
  onPaste: null,
  onChange: null,
  orientation: 'beside',
  readOnly: false,
  scrollMargin: [0, 0, 0, 0],
  setOptions: {},
  showGutter: true,
  showPrintMargin: true,
  splits: 2,
  style: {},
  tabSize: 4,
  theme: 'github',
  value: ['', ''],
  width: '500px',
  wrapEnabled: true,
  enableLineSegments: false,
  enableScrollSync: false,
  markerClassNames: ['', ''],
  noDiffRender: undefined,
};
