import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatProgressBar } from "@angular/material/progress-bar";
import { MatTooltip } from "@angular/material/tooltip";
import { MatTreeModule } from "@angular/material/tree";

interface HomeTagsTreeNode {
  children?: HomeTagsTreeNode[];
  href?: string;
  kind: "root" | "tag";
  name: string;
}

interface ExpandableTree<T> {
  collapse: (node: T) => void;
  expand: (node: T) => void;
  isExpanded: (node: T) => boolean;
}

@Component({
  selector: "site-home-tags-tree",
  standalone: true,
  imports: [MatButton, MatIcon, MatProgressBar, MatTooltip, MatTreeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="tags">
      <a href="#tags" class="heading-link">{{ title() }}</a>
    </h2>

    <mat-tree
      #tree
      class="home-tags-tree"
      [dataSource]="rootNodes"
      [childrenAccessor]="childrenAccessor"
    >
      <mat-tree-node
        *matTreeNodeDef="let node; when: hasChild"
        matTreeNodePadding
        [cdkTreeNodeTypeaheadLabel]="title()"
      >
        <button
          matButton="elevated"
          class="home-tags-tree-toggle"
          type="button"
          [attr.aria-label]="tree.isExpanded(node) ? 'Replier ' + title() : 'Afficher ' + title()"
          [attr.aria-expanded]="tree.isExpanded(node)"
          [matTooltip]="tree.isExpanded(node) ? 'Masquer les tags' : 'Afficher les tags'"
          matTooltipPosition="below"
          (click)="toggle(tree, node)"
        >
          <span>{{ tree.isExpanded(node) ? "Masquer les tags" : "Afficher les tags" }}</span>
          <mat-icon iconPositionEnd class="mat-icon-rtl-mirror" aria-hidden="true">
            {{ tree.isExpanded(node) ? expandLessIcon : expandMoreIcon }}
          </mat-icon>
        </button>
      </mat-tree-node>
    </mat-tree>

    @if (loading()) {
      <mat-progress-bar
        class="home-tags-tree-progress"
        mode="indeterminate"
        aria-label="Chargement des tags"
      />
    }

    @if (loaded() && tree.isExpanded(rootNode)) {
      <ul class="home-tags-tree-links">
        @for (tag of tags(); track tag) {
          <li>
            <a class="home-tags-tree-link" [href]="'/tags/' + tag + '/'">#{{ tag }}</a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host > h2 {
      margin-block: 0 0.75rem;
    }

    .home-tags-tree {
      display: block;
      background: transparent;
      color: var(--site-text);
    }

    .home-tags-tree .mat-tree-node {
      min-height: 0;
      color: var(--site-text);
      font: inherit;
    }

    .home-tags-tree mat-tree-node {
      display: flex;
      align-items: center;
      padding-inline-start: 0 !important;
    }

    .home-tags-tree-toggle.mat-mdc-button-base {
      min-width: 0;
      height: 2.25rem;
      padding-inline: 0.85rem 0.7rem;
      border-radius: 9999px;
      color: var(--site-link);
    }

    .home-tags-tree-toggle .mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.2rem;
      height: 1.2rem;
      font-size: 1.2rem;
      line-height: 1;
    }

    .home-tags-tree-progress.mat-mdc-progress-bar {
      width: min(24rem, 100%);
      height: 0.18rem;
      margin-block: 0.35rem 0.75rem;
      overflow: hidden;
      border-radius: 9999px;
      --mdc-linear-progress-active-indicator-color: var(--site-link);
      --mdc-linear-progress-track-color: color-mix(
        in srgb,
        var(--site-link) 16%,
        transparent
      );
    }

    .home-tags-tree-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.5em;
      margin-block: 0.75rem 1em;
      padding: 0;
      list-style-type: none;
    }

    .home-tags-tree-link {
      color: var(--site-link);
      text-decoration: none;
    }

    .home-tags-tree-link:is(:hover, :focus-visible) {
      text-decoration: underline;
    }

    @media (max-width: 520px) {
      .home-tags-tree-progress.mat-mdc-progress-bar {
        width: 100%;
      }
    }
  `,
})
export class HomeTagsTreeComponent {
  readonly tags = input<string[]>([]);
  readonly title = input("les tags");
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly expandLessIcon = "\uE5CE";
  readonly expandMoreIcon = "\uE5CF";

  readonly rootNode: HomeTagsTreeNode = {
    kind: "root",
    name: "Tags",
    children: [],
  };
  readonly rootNodes = [this.rootNode];

  readonly childrenAccessor = (node: HomeTagsTreeNode) => node.children ?? [];
  readonly hasChild = (_: number, node: HomeTagsTreeNode) => node.kind === "root";

  toggle(tree: ExpandableTree<HomeTagsTreeNode>, node: HomeTagsTreeNode) {
    if (tree.isExpanded(node)) {
      tree.collapse(node);
      return;
    }

    if (this.loaded()) {
      tree.expand(node);
      return;
    }

    this.loading.set(true);
    window.setTimeout(() => {
      this.loaded.set(true);
      this.loading.set(false);
      tree.expand(node);
    }, 140);
  }
}
