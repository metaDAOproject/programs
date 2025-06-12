import autocrat from "./autocrat.js";
import streamflow from "./integration/streamflow.test.js";

export default function suite() {
  describe("#autocrat", autocrat);
  it.only("Streamflow integration test", streamflow);
}
