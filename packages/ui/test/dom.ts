import { GlobalRegistrator } from "@happy-dom/global-registrator";

// react-dom/client and these tests read the DOM's globals, so they exist before either loads.
GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
