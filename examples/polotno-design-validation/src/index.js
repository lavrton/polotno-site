import React from "react";
import ReactDOM from "react-dom/client";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Toolbar } from "polotno/toolbar/toolbar";
import { PagesTimeline } from "polotno/pages-timeline";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";
import { SidePanel } from "polotno/side-panel";
import { Workspace } from "polotno/canvas/workspace";
import { getClientRect } from "polotno/utils/math";
import { getImageSize } from "polotno/utils/image";
import { Button, Popover, Menu, MenuItem, Position } from "@blueprintjs/core";

import "@blueprintjs/core/lib/css/blueprint.css";

import { createStore } from "polotno/model/store";

const store = createStore({
  key: "nFA5H9elEytDyPyvKL7T", // you can create it here: https://polotno.com/cabinet/
  // you can hide back-link on a paid license
  // but it will be good if you can keep it for Polotno project support
  showCredit: true,
});
const page = store.addPage();

store.activePage.addElement({
  type: "text",
  text: "I am outside of page bounds",
  x: -50,
  y: -50,
  fontSize: 50,
  width: 400,
});

store.activePage.addElement({
  type: "text",
  text: "I am too small",
  x: 100,
  y: 100,
  fontSize: 8,
});

store.activePage.addElement({
  type: "image",
  y: 300,
  width: 1080.000000000001,
  height: 719.0000000000005,
  src: "https://images.unsplash.com/photo-1719937051157-d3d81cc28e86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTY5OTZ8MXwxfGFsbHwxfHx8fHx8fHwxNzMwMzc5NjI3fA&ixlib=rb-4.0.3&q=80&w=500",
  cropX: 0.2795826750220386,
  cropY: 0.19885394693882982,
  cropWidth: 0.5757770990900177,
  cropHeight: 0.5757770990900175,
});

const validateDesign = async (store) => {
  const issues = [];
  const elements = [];
  
  // Recursively find all elements in the store, including those in groups
  // Skip pages themselves as they're not elements we want to validate
  store.find((item) => {
    const isPage = store.pages.includes(item);
    if (isPage) {
      return false;
    }
    elements.push(item);
    return false;
  });

  // Iterate through each element to perform validation checks
  for (const element of elements) {
    // --- Check 1: Element Position ---
    // Get element's bounding box (accounts for rotation)
    const { x, y, width, height } = getClientRect(element);
    // Verify element is within page boundaries
    if (x < 0 || y < 0 || x + width > page.width || y + height > page.height) {
      issues.push({
        element,
        message: "Element is outside page bounds",
        type: element.type,
      });
    }

    // --- Check 2: Text Size ---
    // Ensure text is readable by checking minimum font size
    if (element.type === "text" && element.fontSize < 10) {
      issues.push({
        element,
        message: "Text size is too small",
        type: "text",
      });
    }

    // --- Check 3: Image Resolution ---
    // Verify image quality by comparing original vs displayed dimensions
    if (element.type === "image") {
      // TODO: probably we should cache image size per src somewhere
      // to avoid calling getImageSize on every element change
      const { width, height } = await getImageSize(element.src);
      // Calculate actual displayed size after cropping
      const croppedWidth = width * element.cropWidth;
      const croppedHeight = height * element.cropHeight;
      // Check if image is being stretched beyond its original resolution
      if (croppedWidth < element.width || croppedHeight < element.height) {
        issues.push({
          element,
          message: "Low image quality",
          type: "image",
        });
      }
    }
  }
  return issues;
};

const ActionControls = ({ store }) => {
  // State to store validation issues
  const [issues, setIssues] = React.useState([]);

  // Handler to select problematic elements when clicking on issues
  const handleIssueClick = (issue) => {
    // Switch to the page containing the issue
    store.selectPage(issue.element.page.id);
    // Select the problematic element
    store.selectElements([issue.element.id]);
  };

  // Set up validation on store changes
  React.useEffect(() => {
    let timeout;
    
    // Debounced validation request to prevent excessive checks
    const requestValidate = () => {
      if (timeout) {
        return;
      }
      // Wait 1 second after last change before validating
      timeout = setTimeout(async () => {
        setIssues(await validateDesign(store));
        timeout = null;
      }, 1000);
    };

    // Subscribe to store changes
    const off = store.on("change", requestValidate);
    // Initial validation
    requestValidate();

    // Cleanup: remove listener and clear timeout
    return () => {
      off();
      clearTimeout(timeout);
    };
  }, [issues]);

  // Create dropdown menu with validation results
  const content = (
    <Menu>
      {issues.length === 0 ? (
        <MenuItem text="Design is valid. All checks arepassed." />
      ) : (
        issues.map((issue, index) => (
          <MenuItem
            key={index}
            // Show different icons based on issue type
            icon={issue.type === "text" ? "font" : "media"}
            text={`${issue.message}`}
            onClick={() => handleIssueClick(issue)}
          />
        ))
      )}
    </Menu>
  );

  // Render validation button with popover
  return (
    <Popover content={content}>
      <Button
        // Visual feedback based on validation status
        minimal
        icon={issues.length === 0 ? "tick-circle" : "warning-sign"}
        intent={issues.length === 0 ? "none" : "danger"}
      />
    </Popover>
  );
};

export const App = ({ store }) => {
  return (
    <PolotnoContainer style={{ width: "100vw", height: "100vh" }}>
      <SidePanelWrap>
        <SidePanel store={store} />
      </SidePanelWrap>
      <WorkspaceWrap>
        <Toolbar
          store={store}
          components={{
            ActionControls,
          }}
        />
        <Workspace store={store} />
        <ZoomButtons store={store} />
        <PagesTimeline store={store} />
      </WorkspaceWrap>
    </PolotnoContainer>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App store={store} />);
