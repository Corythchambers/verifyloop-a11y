import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/utils";

describe("Example Test", () => {
  it("should render a simple component", () => {
    render(<div data-testid="test-element">Hello World</div>);

    expect(screen.getByTestId("test-element")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(
      <button data-testid="test-button" aria-label="Test button">
        Click me
      </button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveAttribute("aria-label", "Test button");
    expect(button).toBeInTheDocument();
  });
});
