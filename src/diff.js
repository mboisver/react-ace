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
    const lhString = this.state.value[0];
    const rhString = this.state.value[1];

    if (lhString.length === 0 && rhString.length === 0) {
      return [];
    }

    const diff = dmp.diff_main(lhString, rhString);
    dmp.diff_cleanupSemantic(diff);

    const diffedLines = this.generateDiffedLines(diff);
    const codeEditorSettings = this.setCodeMarkers(diffedLines);
    return codeEditorSettings;
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
            lines--;
          }

          linesToHighlight = lines;

          // If the deletion does not include a newline, highlight the same line on the right
          if (linesToHighlight === 0) {
            diffedLines.right.push({
              startLine: cursor.right.row,
              endLine: cursor.right.row,
            });
          } else {
            cursor.left.col = 1;
          }

          // If the last character is a newline, we don't want to highlight that line
          if (lastChar === '\n') {
            linesToHighlight -= 1;
          }

          diffedLines.left.push({
            startLine: cursor.left.row,
            endLine: cursor.left.row + linesToHighlight,
          });

          if (lastLineLength > 0 && this.props.enableLineSegments) {
            diffedLines.left.push({
              startLine: cursor.left.row,
              startCharacter: cursor.left.col,
              endLine: cursor.left.row + linesToHighlight,
              endCharacter: cursor.left.col + lastLineLength,
            });
          }

          cursor.left.row += lines;
          cursor.left.col += lastLineLength;
          break;
        case C.DIFF_INSERT:
          // If the insertion starts with a newline, push the cursor down to that line
          if (firstChar === '\n') {
            cursor.right.row++;
            lines--;
          }

          linesToHighlight = lines;

          // If the insertion does not include a newline, highlight the same line on the left
          if (linesToHighlight === 0) {
            diffedLines.left.push({
              startLine: cursor.left.row,
              endLine: cursor.left.row,
            });
          } else {
            cursor.right.col = 1;
          }

          // If the last character is a newline, we don't want to highlight that line
          if (lastChar === '\n') {
            linesToHighlight -= 1;
          }

          diffedLines.right.push({
            startLine: cursor.right.row,
            endLine: cursor.right.row + linesToHighlight,
          });

          if (lastLineLength > 0 && this.props.enableLineSegments) {
            diffedLines.right.push({
              startLine: cursor.right.row,
              startCharacter: cursor.right.col,
              endLine: cursor.right.row + linesToHighlight,
              endCharacter: cursor.right.col + lastLineLength,
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
  setCodeMarkers(diffedLines = { left: [], right: [] }) {
    const codeEditorSettings = [];

    const newMarkerSet = {
      left: [],
      right: [],
    };

    for (let i = 0; i < diffedLines.left.length; i++) {
      let partialHighlight = diffedLines.left[i].endCharacter > diffedLines.left[i].startCharacter;
      let markerObj = {
        startRow: diffedLines.left[i].startLine - 1,
        startCol: diffedLines.left[i].startCharacter - 1,
        endRow: partialHighlight ? diffedLines.left[i].endLine - 1 : diffedLines.left[i].endLine,
        endCol: diffedLines.left[i].endCharacter - 1,
        type: 'text',
        className: 'codeMarker ' + this.props.markerClassNames[0] + (partialHighlight ? ' codeMarker-lineSegment' : ''),
      };
      newMarkerSet.left.push(markerObj);
    }

    for (let i = 0; i < diffedLines.right.length; i++) {
      let partialHighlight = diffedLines.right[i].endCharacter > diffedLines.right[i].startCharacter;
      let markerObj = {
        startRow: diffedLines.right[i].startLine - 1,
        startCol: diffedLines.right[i].startCharacter - 1,
        endRow: partialHighlight ? diffedLines.right[i].endLine - 1 : diffedLines.right[i].endLine,
        endCol: diffedLines.right[i].endCharacter - 1,
        type: 'text',
        className: 'codeMarker ' + this.props.markerClassNames[1] + (partialHighlight ? ' codeMarker-lineSegment' : ''),
      };
      newMarkerSet.right.push(markerObj);
    }

    codeEditorSettings[0] = newMarkerSet.left;
    codeEditorSettings[1] = newMarkerSet.right;

    return codeEditorSettings;
  }

  lineSkips(sourceMarkers, sourceLength, targetMarkers, targetLength, targetIndex) {
    const rows = {};
    const rangeContains = index => range => index >= range.startRow && index < range.endRow;
    for (let sourceRow = 0, targetRow = -1; sourceRow < sourceLength; sourceRow++) {
      rows[sourceRow] = [];
      const markedOnSource = sourceMarkers.find(rangeContains(sourceRow));
      const markedOnTarget = targetMarkers.find(rangeContains(targetRow + 1));
      if ((!markedOnSource && !markedOnTarget) || (markedOnSource && markedOnTarget)) {
        rows[sourceRow][targetIndex] = ++targetRow;
      } else if (markedOnSource) {
        rows[sourceRow][targetIndex] = targetRow;
      } else if (markedOnTarget) {
        sourceRow--;
        targetRow++;
      }
    }
    return rows;
  }

  scrollSyncLines(diff) {
    const leftMarkers = diff[0];
    const leftLines = this.props.value[0].split('\n').length;
    const rightMarkers = diff[1];
    const rightLines = this.props.value[1].split('\n').length;

    return [
      this.lineSkips(leftMarkers, leftLines, rightMarkers, rightLines, 1),
      this.lineSkips(rightMarkers, rightLines, leftMarkers, leftLines, 0)
    ];
  }

  render() {
    const markers = this.diff();
    const lineSkips = this.scrollSyncLines(markers);
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
};
