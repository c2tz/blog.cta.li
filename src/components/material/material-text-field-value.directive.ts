import { Directive, ElementRef, output } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";

interface MaterialTextFieldElement extends HTMLElement {
  readonly updateComplete?: Promise<unknown>;
}

@Directive({
  selector: "md-outlined-text-field[siteMaterialValue]",
  standalone: true,
})
export class MaterialTextFieldValueDirective implements AfterViewInit, OnDestroy {
  readonly valueChange = output<string>({ alias: "siteMaterialValueChange" });

  private control?: HTMLInputElement | HTMLTextAreaElement;
  private destroyed = false;

  constructor(private readonly elementRef: ElementRef<MaterialTextFieldElement>) {}

  ngAfterViewInit() {
    void this.connect();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.control?.removeEventListener("input", this.handleInput);
    this.control = undefined;
  }

  private async connect() {
    if (typeof customElements === "undefined") return;

    await customElements.whenDefined("md-outlined-text-field");
    const host = this.elementRef.nativeElement;
    await host.updateComplete;
    if (this.destroyed) return;

    const control = host.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    );
    if (!control) return;

    this.control = control;
    control.addEventListener("input", this.handleInput);
  }

  private readonly handleInput = (event: Event) => {
    const value = (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
    this.valueChange.emit(value);
  };
}
